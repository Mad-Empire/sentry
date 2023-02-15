import time
import uuid
from typing import Optional

from django.conf import settings

from sentry.replays.lib.storage import make_storage_driver_from_id
from sentry.replays.models import ReplayRecordingSegment
from sentry.tasks.base import instrumented_task
from sentry.utils import json, kafka_config
from sentry.utils.pubsub import KafkaPublisher

replay_publisher: Optional[KafkaPublisher] = None


@instrumented_task(
    name="sentry.replays.tasks.delete_recording_segments",
    queue="replays.delete_replay",
    default_retry_delay=5,
    max_retries=5,
)
def delete_recording_segments(project_id: int, replay_id: str, **kwargs: dict) -> None:
    """Asynchronously delete a replay."""
    archive_replay(project_id, replay_id)
    delete_replay_recording(project_id, replay_id)


@instrumented_task(
    name="sentry.replays.tasks.delete_recording_segment",
    queue="replays.delete_replay",
    default_retry_delay=5,
    max_retries=5,
)
def delete_recording_segment(replay_id: str, segment_id: int) -> None:
    """Asynchronously delete a recording-segment."""
    segment = ReplayRecordingSegment.objects.filter(
        replay_id=replay_id,
        segment_id=segment_id,
    ).first()

    # Delete the remote storage object.
    driver = make_storage_driver_from_id(segment.driver)
    driver.delete(segment)

    # Delete the row.
    segment.delete()


def delete_replay_recording(project_id: int, replay_id: str) -> None:
    """Delete all recording-segments associated with a Replay."""
    segments = ReplayRecordingSegment.objects.filter(
        replay_id=replay_id, project_id=project_id
    ).all()
    for segment in segments:
        # Segments are deleted in parallel by worker processes.
        delete_recording_segment.delay(segment.replay_id, segment.segment_id)


def archive_replay(project_id: int, replay_id: str) -> None:
    """Archive a Replay instance. The Replay is not deleted."""
    replay_payload = {
        "type": "replay_event",
        "replay_id": replay_id,
        "event_id": uuid.uuid4().hex,
        "segment_id": None,
        "trace_ids": [],
        "error_ids": [],
        "urls": [],
        "timestamp": time.time(),
        "is_archived": True,
        "platform": None,
    }

    publisher = _initialize_publisher()
    publisher.publish(
        "ingest-replay-events",
        json.dumps(
            {
                "type": "replay_event",
                "start_time": int(time.time()),
                "replay_id": replay_id,
                "project_id": project_id,
                "segment_id": None,
                "retention_days": 30,
                "payload": list(bytes(json.dumps(replay_payload).encode())),
            }
        ),
    )


def _initialize_publisher() -> KafkaPublisher:
    global replay_publisher

    if replay_publisher is None:
        config = settings.KAFKA_TOPICS[settings.KAFKA_INGEST_REPLAY_EVENTS]
        replay_publisher = KafkaPublisher(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"]),
            asynchronous=False,
        )

    return replay_publisher
