import uniqBy from 'lodash/uniqBy';

import type {ExceptionValue, Frame, Organization, PlatformType} from 'sentry/types';
import {defined} from 'sentry/utils';
import {QueryKey, useQueries, useQuery, UseQueryOptions} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface BaseSourceMapDebugError {
  message: string;
  type: SourceMapProcessingIssueType;
}

interface UnknownErrorDebugError extends BaseSourceMapDebugError {
  type: SourceMapProcessingIssueType.UNKNOWN_ERROR;
}
interface MissingReleaseDebugError extends BaseSourceMapDebugError {
  type: SourceMapProcessingIssueType.MISSING_RELEASE;
}
interface MissingUserAgentDebugError extends BaseSourceMapDebugError {
  data: {version: string};
  type: SourceMapProcessingIssueType.MISSING_USER_AGENT;
}
interface MissingSourcemapsDebugError extends BaseSourceMapDebugError {
  type: SourceMapProcessingIssueType.MISSING_SOURCEMAPS;
}
interface UrlNotValidDebugError extends BaseSourceMapDebugError {
  data: {absValue: string};
  type: SourceMapProcessingIssueType.URL_NOT_VALID;
}
interface PartialMatchDebugError extends BaseSourceMapDebugError {
  data: {insertPath: string; matchedSourcemapPath: string};
  type: SourceMapProcessingIssueType.PARTIAL_MATCH;
}

export type SourceMapDebugError =
  | UnknownErrorDebugError
  | MissingReleaseDebugError
  | MissingUserAgentDebugError
  | MissingSourcemapsDebugError
  | UrlNotValidDebugError
  | PartialMatchDebugError;

export interface SourceMapDebugResponse {
  errors: SourceMapDebugError[];
}

export enum SourceMapProcessingIssueType {
  UNKNOWN_ERROR = 'unknown_error',
  MISSING_RELEASE = 'no_release_on_event',
  MISSING_USER_AGENT = 'no_user_agent_on_release',
  MISSING_SOURCEMAPS = 'no_sourcemaps_on_release',
  URL_NOT_VALID = 'url_not_valid',
  PARTIAL_MATCH = 'partial_match',
}

const sourceMapDebugQuery = ({
  orgSlug,
  projectSlug,
  eventId,
  frameIdx,
  exceptionIdx,
}: UseSourceMapDebugProps): QueryKey => [
  `/projects/${orgSlug}/${projectSlug}/events/${eventId}/source-map-debug/`,
  {
    query: {
      frame_idx: `${frameIdx}`,
      exception_idx: `${exceptionIdx}`,
    },
  },
];

interface UseSourceMapDebugProps {
  eventId: string;
  exceptionIdx: number;
  frameIdx: number;
  orgSlug: string;
  projectSlug: string;
}

export type StacktraceFilenameQuery = {filename: string; query: UseSourceMapDebugProps};

export function useSourceMapDebug(
  props?: UseSourceMapDebugProps,
  options: Partial<UseQueryOptions<SourceMapDebugResponse>> = {}
) {
  return useQuery<SourceMapDebugResponse>(props ? sourceMapDebugQuery(props) : [''], {
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    notifyOnChangeProps: ['data'],
    ...options,
    enabled: !!options.enabled && defined(props),
  });
}

export function useSourceMapDebugQueries(props: UseSourceMapDebugProps[]) {
  const api = useApi({persistInFlight: true});

  const options = {
    staleTime: Infinity,
    retry: false,
  };
  return useQueries({
    queries: props.map<UseQueryOptions<SourceMapDebugResponse>>(p => {
      const key = sourceMapDebugQuery(p);
      return {
        queryKey: sourceMapDebugQuery(p),
        // TODO: Move queryFn as a default in queryClient.tsx
        queryFn: () =>
          api.requestPromise(key[0], {
            method: 'GET',
            query: key[1]?.query,
          }),
        ...options,
      };
    }),
  });
}

const ALLOWED_PLATFORMS = [
  'node',
  'javascript',
  'javascript-react',
  'javascript-angular',
  'javascript-angularjs',
  'javascript-backbone',
  'javascript-ember',
  'javascript-gatsby',
  'javascript-vue',
  'javascript-nextjs',
  'javascript-remix',
  'javascript-svelte',
  // dart and unity might require more docs links
  // 'dart',
  // 'unity',
];
const MAX_FRAMES = 3;

/**
 * Check we have all required props and platform is supported
 */
export function debugFramesEnabled({
  platform,
  eventId,
  organization,
  projectSlug,
}: {
  platform: PlatformType;
  eventId?: string;
  organization?: Organization | null;
  projectSlug?: string;
}) {
  if (!organization || !organization.features || !projectSlug || !eventId) {
    return false;
  }

  if (!organization.features.includes('fix-source-map-cta')) {
    return false;
  }

  return ALLOWED_PLATFORMS.includes(platform);
}

/**
 * Returns an array of unique filenames and the first frame they appear in.
 * Filters out non inApp frames and frames without a line number.
 * Limited to only the first 3 unique filenames.
 */
export function getUniqueFilesFromException(
  excValues: ExceptionValue[],
  props: Omit<UseSourceMapDebugProps, 'frameIdx' | 'exceptionIdx'>
): StacktraceFilenameQuery[] {
  // Not using .at(-1) because we need to use the index later
  const exceptionIdx = excValues.length - 1;
  const fileFrame = (excValues[exceptionIdx]?.stacktrace?.frames ?? [])
    // Get the frame numbers before filtering
    .map<[Frame, number]>((frame, idx) => [frame, idx])
    .filter(
      ([frame]) =>
        frame.inApp &&
        frame.filename &&
        // Line number might not work for non-javascript languages
        defined(frame.lineNo)
    )
    .map<StacktraceFilenameQuery>(([frame, idx]) => ({
      filename: frame.filename!,
      query: {...props, frameIdx: idx, exceptionIdx},
    }));

  // Return only the first 3 unique filenames
  // TODO: reverse only applies to newest first
  return uniqBy(fileFrame.reverse(), ({filename}) => filename).slice(0, MAX_FRAMES);
}
