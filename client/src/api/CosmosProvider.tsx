import { createContext, useContext, type ReactNode } from 'react';
import type { CosmosResponse } from './cosmos-api';

const CosmosContext = createContext<CosmosResponse | null>(null);

export class CosmosProviderMissingError extends Error {
  readonly errorCode = 'NO_COSMOS_PROVIDER';

  constructor() {
    super('useCosmos() was called outside <CosmosProvider>; render it only after /api/cosmos has loaded');
    this.name = 'CosmosProviderMissingError';
  }
}

interface CosmosProviderProps {
  response: CosmosResponse;
  children: ReactNode;
}

export function CosmosProvider({ response, children }: CosmosProviderProps) {
  return <CosmosContext.Provider value={response}>{children}</CosmosContext.Provider>;
}

/** The loaded `/api/cosmos` response. Never undefined: the provider mounts only once data is ready. */
export function useCosmos(): CosmosResponse {
  const response = useContext(CosmosContext);
  if (!response) throw new CosmosProviderMissingError();
  return response;
}
