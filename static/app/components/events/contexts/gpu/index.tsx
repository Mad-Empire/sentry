import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event} from 'sentry/types/event';

import {geKnownData, getUnknownData} from '../utils';

import {getGPUKnownDataDetails} from './getGPUKnownDataDetails';
import type {GPUData} from './types';
import {GPUKnownDataType} from './types';

type Props = {
  data: GPUData;
  event: Event;
};

export const gpuKnownDataValues = [
  GPUKnownDataType.NAME,
  GPUKnownDataType.VERSION,
  GPUKnownDataType.VENDOR_NAME,
  GPUKnownDataType.MEMORY,
  GPUKnownDataType.NPOT_SUPPORT,
  GPUKnownDataType.MULTI_THREAD_RENDERING,
  GPUKnownDataType.API_TYPE,
];

const gpuIgnoredDataValues = [];

export function GPUEventContext({event, data}: Props) {
  const meta = event._meta?.contexts?.gpu ?? {};

  const gpuValues = [...gpuKnownDataValues];

  if (data.vendor_id > 0) {
    gpuValues.unshift(GPUKnownDataType.VENDOR_ID);
  }

  if (data.id > 0) {
    gpuValues.unshift(GPUKnownDataType.ID);
  }

  return (
    <Fragment>
      <ContextBlock
        data={geKnownData<GPUData, GPUKnownDataType>({
          data,
          meta,
          knownDataTypes: gpuValues,
          onGetKnownDataDetails: v => getGPUKnownDataDetails(v),
        })}
      />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: [...gpuValues, ...gpuIgnoredDataValues],
          meta,
        })}
      />
    </Fragment>
  );
}
