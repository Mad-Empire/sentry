import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Collection, Iterator, List, Optional, Sequence, Tuple

from sentry.utils import redis
from sentry.utils.services import Service

Hash = int
Timestamp = int


@dataclass(frozen=True)
class Quota:
    # The number of seconds to apply the limit to.
    window_seconds: int

    # A number between 1 and `window_seconds`. Since `window_seconds` is a
    # sliding window, configure what the granularity of that window is.
    #
    # If this is equal to `window_seconds`, the quota resets to 0 every
    # `window_seconds`.  If this is a very small number, the window slides
    # "more smoothly" at the expense of having much more redis keys.
    #
    # The number of redis keys required to enforce a quota is `window_seconds /
    # granularity_seconds`.
    granularity_seconds: int

    #: How many units are allowed within the given window.
    limit: int

    def __post__init__(self) -> None:
        assert self.window_seconds % self.granularity_seconds == 0

    def iter_window(self, request_timestamp: int) -> Iterator[int]:
        """
        Iterate over the quota's window, yielding timestamps representing each granule.

        This function is used to calculate keys for storing the number of
        requests made in each granule.

        The iteration is done in reverse-order (newest timestamp to oldest),
        starting with the key to which a currently-processed request should be
        added. That request's timestamp is `request_timestamp`.

        * `request_timestamp / self.granularity_seconds`
        * `request_timestamp / self.granularity_seconds - 1`
        * `request_timestamp / self.granularity_seconds - 2`
        * ...
        """
        value = request_timestamp // self.granularity_seconds

        for granule_i in range(self.window_seconds // self.granularity_seconds):
            value -= 1
            assert value >= 0, value
            yield value


@dataclass(frozen=True)
class RequestedQuota:
    # A string that all redis state is prefixed with. For example
    # `sentry-string-indexer` where 123 is an organization id.
    prefix: str

    # A unit is an abstract term for the object type we want to limit the
    # cardinality of.
    #
    # For example, if you want to limit the cardinality of timeseries in a
    # metrics service, this would be a set of hashes composed from `(org_id,
    # metric_name, tags)`.
    #
    # ...though you can probably omit org_id if it is already in the prefix.
    unit_hashes: Collection[Hash]

    # Which quotas to check against. The number of not-yet-seen hashes must
    # "fit" into all quotas.
    quotas: Sequence[Quota]


@dataclass(frozen=True)
class GrantedQuota:
    request: RequestedQuota

    # The subset of hashes provided by the user `self.request` that were
    # accepted by the limiter.
    granted_unit_hashes: Collection[Hash]

    # If len(granted_unit_hashes) < len(RequestedQuota.unit_hashes), this
    # contains the quotas that were reached.
    reached_quotas: Sequence[Quota]


class CardinalityLimiter(Service):
    """
    A kind of limiter that limits set cardinality instead of a rate/count.

    The high-level concepts are very similar to `sentry.ratelimits.sliding_windows`.

    Instead of passing in numbers and getting back smaller numbers, however, the
    user passes in a set and gets back a smaller set. Set elements that have
    already been observed in any quota's window are "for free" and will not
    count towards any quota.

    The implementation hasn't been finalized yet, but we expect that under the hood
    this cardinality limiter will be more expensive to operate than a simple rate
    limiter, as it needs to keep track of already-seen set elements. The memory
    usage in Redis will most likely be proportional to the set size.

    This kind of limiter does not support prefix overrides, which practically means
    that there can only be a per-org or a global limit, not both at once.
    """

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Tuple[Timestamp, Sequence[GrantedQuota]]:
        """
        Given a set of quotas requests and limits, compute how much quota could
        be consumed.

        :param requests: The requests to return "grants" for.
        :param timestamp: The timestamp of the incoming request. Defaults to
            the current timestamp.

            Providing a too old timestamp here _can_ effectively disable rate
            limits, as the older request counts may no longer be stored.
            However, consistently providing old timestamps here will work
            correctly.
        """
        if timestamp is None:
            timestamp = int(time.time())
        else:
            timestamp = int(timestamp)

        grants = [
            GrantedQuota(
                request=request, granted_unit_hashes=request.unit_hashes, reached_quotas=[]
            )
            for request in requests
        ]

        return timestamp, grants

    def use_quotas(
        self,
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        """
        Given a set of requests and the corresponding return values from
        `check_within_quotas`, consume the quotas.

        :param requests: The requests that have previously been passed to
            `check_within_quotas`.
        :param timestamp: The request timestamp that has previously been passed
            to `check_within_quotas`.
        :param grants: The return value of `check_within_quotas` which
            indicates how much quota should actually be consumed.
        """
        pass


class RedisCardinalityLimiter(CardinalityLimiter):
    def __init__(self, cluster: str = "default", cluster_shard_factor: int = 3) -> None:
        self.client = redis.redis_clusters.get(cluster)
        self.cluster_shard_factor = cluster_shard_factor
        super().__init__()

    @staticmethod
    def _get_timeseries_key(request: RequestedQuota, hash: Hash) -> str:
        return f"cardinality-counter-{request.prefix}-{hash}"

    def _get_read_sets_keys(
        self, request: RequestedQuota, quota: Quota, timestamp: Timestamp
    ) -> Sequence[str]:
        oldest_time_bucket = list(quota.iter_window(timestamp))[-1]
        return [
            f"cardinality-sets-{request.prefix}-{shard}-{oldest_time_bucket}"
            for shard in range(self.cluster_shard_factor)
        ]

    def _get_write_sets_keys(
        self, request: RequestedQuota, quota: Quota, timestamp: Timestamp, hash: Hash
    ) -> Sequence[str]:
        shard = hash % self.cluster_shard_factor
        return [
            f"cardinality-sets-{request.prefix}-{shard}-{time_bucket}"
            for time_bucket in quota.iter_window(timestamp)
        ]

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Tuple[Timestamp, Sequence[GrantedQuota]]:
        if timestamp is None:
            timestamp = int(time.time())
        else:
            timestamp = int(timestamp)

        unit_keys_to_get: List[str] = []
        set_keys_to_count: List[str] = []

        for request in requests:
            if request.quotas:
                for hash in request.unit_hashes:
                    unit_keys_to_get.append(self._get_timeseries_key(request, hash))

            for quota in request.quotas:
                set_keys_to_count.extend(self._get_read_sets_keys(request, quota, timestamp))

        if not unit_keys_to_get and not set_keys_to_count:
            # If there are no keys to fetch (i.e. there are no quotas to
            # enforce), we can save the redis call entirely and just grant all
            # quotas immediately.
            return timestamp, [
                GrantedQuota(
                    request=request, granted_unit_hashes=request.unit_hashes, reached_quotas=[]
                )
                for request in requests
            ]

        with self.client.pipeline(transaction=False) as pipeline:
            pipeline.mget(unit_keys_to_get)
            # O(self.cluster_shard_factor * len(requests)), assuming there's
            # only one per-org quota
            for key in set_keys_to_count:
                pipeline.scard(key)

            results = iter(pipeline.execute())
            unit_keys = dict(zip(unit_keys_to_get, next(results)))
            set_counts = dict(zip(set_keys_to_count, results))

        grants = []
        for request in requests:
            if not request.quotas:
                grants.append(
                    GrantedQuota(
                        request=request, granted_unit_hashes=request.unit_hashes, reached_quotas=[]
                    )
                )
                continue

            granted_hashes = []

            quotas_by_remaining_limit = defaultdict(list)
            for quota in request.quotas:
                remaining_limit = max(
                    0,
                    quota.limit
                    - sum(
                        set_counts[k] for k in self._get_read_sets_keys(request, quota, timestamp)
                    ),
                )
                quotas_by_remaining_limit[remaining_limit].append(quota)

            smallest_remaining_limit = min(quotas_by_remaining_limit)
            smallest_remaining_limit_running = smallest_remaining_limit
            reached_quotas = []

            for hash in request.unit_hashes:
                if unit_keys[self._get_timeseries_key(request, hash)]:
                    granted_hashes.append(hash)
                elif smallest_remaining_limit_running > 0:
                    granted_hashes.append(hash)
                    smallest_remaining_limit_running -= 1
                else:
                    reached_quotas = quotas_by_remaining_limit[smallest_remaining_limit]
                    break

            grants.append(
                GrantedQuota(
                    request=request,
                    granted_unit_hashes=granted_hashes,
                    reached_quotas=reached_quotas,
                )
            )

        return timestamp, grants

    def use_quotas(
        self,
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        unit_keys_to_set = {}
        set_keys_to_add = defaultdict(set)
        set_keys_ttl = {}

        for grant in grants:
            if not grant.request.quotas:
                continue

            key_ttl = max(quota.window_seconds for quota in grant.request.quotas)

            for hash in grant.granted_unit_hashes:
                unit_key = self._get_timeseries_key(grant.request, hash)
                unit_keys_to_set[unit_key] = key_ttl

                for quota in grant.request.quotas:
                    for set_key in self._get_write_sets_keys(grant.request, quota, timestamp, hash):
                        set_keys_ttl[set_key] = quota.window_seconds
                        set_keys_to_add[set_key].add(hash)

        if not set_keys_to_add and not unit_keys_to_set:
            # If there are no keys to mutate (i.e. there are no quotas to
            # enforce), we can save the redis call entirely.
            return

        with self.client.pipeline(transaction=False) as pipeline:
            for key, ttl in unit_keys_to_set.items():
                pipeline.setex(key, ttl, 1)

            for key, items in set_keys_to_add.items():
                items_list = list(items)
                while items_list:
                    # SADD can take multiple arguments, but if you provide too
                    # many you end up with very long-running redis commands.
                    pipeline.sadd(key, *items_list[:200])
                    items_list = items_list[200:]

                pipeline.expire(key, set_keys_ttl[key])

            pipeline.execute()
