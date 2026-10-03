import { useCallback, useEffect, useState } from 'react';
import type { CosmosResponse } from './cosmos-api';
import { CosmosFetchError, startCosmosFetch } from './cosmosClient';

export type CosmosLoadState =
  | { status: 'loading' }
  | { status: 'ready'; response: CosmosResponse }
  | { status: 'error'; errorCode: string };

export interface CosmosLoad {
  state: CosmosLoadState;
  retry: () => void;
}

/** Subscribes to the single `/api/cosmos` load; `retry` starts a fresh request after a failure. */
export function useCosmosLoad(): CosmosLoad {
  const [state, setState] = useState<CosmosLoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    startCosmosFetch().then(
      (response) => {
        if (isCurrent) setState({ status: 'ready', response });
      },
      (error: unknown) => {
        if (isCurrent) setState({ status: 'error', errorCode: error instanceof CosmosFetchError ? error.errorCode : 'COSMOS_UNKNOWN' });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((count) => count + 1);
  }, []);

  return { state, retry };
}
