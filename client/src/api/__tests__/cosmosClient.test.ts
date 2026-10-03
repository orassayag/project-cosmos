import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COSMOS_FETCH_TIMEOUT_MS,
  CosmosFetchError,
  resetCosmosFetchForTests,
  startCosmosFetch,
} from '../cosmosClient';

const VALID_BODY = {
  version: 'e14ae1d530f1cc30',
  data: { domains: [], services: [], topics: [], scenarios: [], steps: [], incidents: [] },
  derived: { edges: [], blastRadius: {}, ownership: {}, healthStatus: {}, latestDrift: {}, playable: {} },
};

type FetchCall = { signal: AbortSignal; respond: (response: Response) => void; fail: (error: unknown) => void };

/** A fake fetch whose calls stay pending until the test answers them; an aborted call rejects like the real one. */
function installFakeFetch() {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const signal = init.signal as AbortSignal;
    return new Promise<Response>((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      calls.push({ signal, respond: resolve, fail: reject });
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

async function expectFetchError(promise: Promise<unknown>, errorCode: string) {
  const error = await promise.then(
    () => undefined,
    (rejection: unknown) => rejection,
  );
  expect(error).toBeInstanceOf(CosmosFetchError);
  expect((error as CosmosFetchError).errorCode).toBe(errorCode);
}

describe('startCosmosFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCosmosFetchForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves with the response body', async () => {
    const { calls } = installFakeFetch();
    const pending = startCosmosFetch();

    calls[0].respond(Response.json(VALID_BODY));

    await expect(pending).resolves.toEqual(VALID_BODY);
  });

  it('resolves a slow answer that arrives before the timeout', async () => {
    const { calls } = installFakeFetch();
    const pending = startCosmosFetch();

    await vi.advanceTimersByTimeAsync(COSMOS_FETCH_TIMEOUT_MS - 1);
    expect(calls[0].signal.aborted).toBe(false);
    calls[0].respond(Response.json(VALID_BODY));

    await expect(pending).resolves.toEqual(VALID_BODY);
  });

  it('aborts the request and rejects with a timeout after 10 seconds', async () => {
    const { calls } = installFakeFetch();
    const pending = startCosmosFetch();
    const assertion = expectFetchError(pending, 'COSMOS_TIMEOUT');

    await vi.advanceTimersByTimeAsync(COSMOS_FETCH_TIMEOUT_MS);

    expect(calls[0].signal.aborted).toBe(true);
    await assertion;
  });

  it('starts a fresh request on Retry after the first attempt fails, and the retry succeeds', async () => {
    const { calls, fetchMock } = installFakeFetch();
    const firstAttempt = startCosmosFetch();
    calls[0].respond(new Response('down', { status: 503 }));
    await expectFetchError(firstAttempt, 'COSMOS_HTTP_STATUS');

    const retry = startCosmosFetch();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    calls[1].respond(Response.json(VALID_BODY));

    await expect(retry).resolves.toEqual(VALID_BODY);
  });

  it('starts a fresh request on Retry after a timeout', async () => {
    const { calls, fetchMock } = installFakeFetch();
    const firstAttempt = startCosmosFetch();
    const assertion = expectFetchError(firstAttempt, 'COSMOS_TIMEOUT');
    await vi.advanceTimersByTimeAsync(COSMOS_FETCH_TIMEOUT_MS);
    await assertion;

    const retry = startCosmosFetch();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    calls[1].respond(Response.json(VALID_BODY));

    await expect(retry).resolves.toEqual(VALID_BODY);
  });

  it('rejects a malformed response through the guard', async () => {
    const { calls } = installFakeFetch();
    const pending = startCosmosFetch();

    calls[0].respond(Response.json({ version: 'abc', data: { services: 'nope' }, derived: {} }));

    await expectFetchError(pending, 'COSMOS_MALFORMED_RESPONSE');
  });

  it('shares one request between concurrent callers', async () => {
    const { calls, fetchMock } = installFakeFetch();
    const first = startCosmosFetch();
    const second = startCosmosFetch();

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    calls[0].respond(Response.json(VALID_BODY));
    await expect(Promise.all([first, second])).resolves.toEqual([VALID_BODY, VALID_BODY]);
  });

  it('keeps a successful response cached without fetching again', async () => {
    const { calls, fetchMock } = installFakeFetch();
    const first = startCosmosFetch();
    calls[0].respond(Response.json(VALID_BODY));
    await first;

    expect(startCosmosFetch()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
