import type { CosmosResponse } from './cosmos-api';

export const COSMOS_ENDPOINT = '/api/cosmos';
export const COSMOS_FETCH_TIMEOUT_MS = 10_000;

export type CosmosFetchErrorCode = 'COSMOS_TIMEOUT' | 'COSMOS_HTTP_STATUS' | 'COSMOS_NETWORK' | 'COSMOS_MALFORMED_RESPONSE';

export class CosmosFetchError extends Error {
  readonly errorCode: CosmosFetchErrorCode;

  constructor(message: string, context: { errorCode: CosmosFetchErrorCode; error?: unknown }) {
    super(message, { cause: context.error });
    this.name = 'CosmosFetchError';
    this.errorCode = context.errorCode;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const REQUIRED_DATA_ARRAYS = ['domains', 'services', 'topics', 'scenarios', 'steps', 'incidents'] as const;
const REQUIRED_DERIVED_KEYS = ['edges', 'blastRadius', 'ownership', 'healthStatus', 'latestDrift', 'playable'] as const;

/** A shape check, not a full schema: the server validates the data; this catches a wrong or truncated body. */
export function guardCosmosResponse(body: unknown): CosmosResponse {
  const fail = (reason: string): never => {
    throw new CosmosFetchError(`Malformed ${COSMOS_ENDPOINT} response: ${reason}`, {
      errorCode: 'COSMOS_MALFORMED_RESPONSE',
    });
  };
  if (!isRecord(body)) return fail(`expected a JSON object, received ${body === null ? 'null' : typeof body}`);
  if (typeof body.version !== 'string' || body.version.length === 0) return fail('`version` must be a non-empty string');
  const { data, derived } = body;
  if (!isRecord(data)) return fail('`data` must be an object');
  if (!isRecord(derived)) return fail('`derived` must be an object');
  for (const key of REQUIRED_DATA_ARRAYS) {
    if (!Array.isArray(data[key])) return fail(`\`data.${key}\` must be an array`);
  }
  for (const key of REQUIRED_DERIVED_KEYS) {
    if (!(key in derived)) return fail(`\`derived.${key}\` is missing`);
  }
  return body as unknown as CosmosResponse;
}

export async function fetchCosmos(signal: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(COSMOS_ENDPOINT, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal.aborted) {
      throw new CosmosFetchError(`${COSMOS_ENDPOINT} did not answer within ${COSMOS_FETCH_TIMEOUT_MS / 1000}s`, {
        errorCode: 'COSMOS_TIMEOUT',
        error,
      });
    }
    throw new CosmosFetchError(`Could not reach ${COSMOS_ENDPOINT}`, { errorCode: 'COSMOS_NETWORK', error });
  }
  if (!response.ok) {
    throw new CosmosFetchError(`${COSMOS_ENDPOINT} answered ${response.status}`, { errorCode: 'COSMOS_HTTP_STATUS' });
  }
  try {
    return await response.json();
  } catch (error) {
    if (signal.aborted) {
      throw new CosmosFetchError(`${COSMOS_ENDPOINT} did not finish within ${COSMOS_FETCH_TIMEOUT_MS / 1000}s`, {
        errorCode: 'COSMOS_TIMEOUT',
        error,
      });
    }
    throw new CosmosFetchError(`${COSMOS_ENDPOINT} did not return JSON`, { errorCode: 'COSMOS_MALFORMED_RESPONSE', error });
  }
}

let cachedPromise: Promise<CosmosResponse> | undefined;

/**
 * Starts loading the cosmos once and hands every caller the same promise. A failed or
 * timed-out attempt is forgotten, so the next call (Retry) starts a fresh request (I2).
 */
export function startCosmosFetch(): Promise<CosmosResponse> {
  if (cachedPromise) return cachedPromise;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COSMOS_FETCH_TIMEOUT_MS);
  const attempt = fetchCosmos(controller.signal)
    .then(guardCosmosResponse)
    .catch((error: unknown) => {
      if (cachedPromise === attempt) cachedPromise = undefined;
      throw error;
    })
    .finally(() => clearTimeout(timeoutId));
  cachedPromise = attempt;
  return attempt;
}

/** Tests only: forget any loaded or in-flight response. */
export function resetCosmosFetchForTests(): void {
  cachedPromise = undefined;
}
