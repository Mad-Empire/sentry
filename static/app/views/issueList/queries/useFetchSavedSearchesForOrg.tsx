import type {SavedSearch} from 'sentry/types';
import type {UseQueryOptions} from 'sentry/utils/queryClient';
import {useQuery} from 'sentry/utils/queryClient';

type FetchSavedSearchesForOrgParameters = {
  orgSlug: string;
};

type FetchSavedSearchesForOrgResponse = SavedSearch[];

export const makeFetchSavedSearchesForOrgQueryKey = ({
  orgSlug,
}: FetchSavedSearchesForOrgParameters) =>
  [`/organizations/${orgSlug}/searches/`] as const;

export const useFetchSavedSearchesForOrg = (
  {orgSlug}: FetchSavedSearchesForOrgParameters,
  options: Partial<UseQueryOptions<FetchSavedSearchesForOrgResponse>> = {}
) => {
  return useQuery<FetchSavedSearchesForOrgResponse>(
    makeFetchSavedSearchesForOrgQueryKey({orgSlug}),
    {
      staleTime: 30000,
      ...options,
    }
  );
};
