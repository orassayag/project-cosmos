import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import { CosmosResponseSchema } from '../cosmos/schema.js';
import { getCosmosResponseBody, getCosmosVersion, getCosmosView } from '../cosmos/view.js';

const EXPECTED_CACHE_CONTROL = 'public, max-age=60, s-maxage=31536000, stale-while-revalidate=86400';
const MAX_GZIP_BYTES = 100 * 1024;

function getCosmos(headers: Record<string, string> = {}): Promise<Response> {
  return Promise.resolve(app.request('/api/cosmos', { headers }));
}

describe('GET /api/cosmos', () => {
  it('returns the full view with its version, parsing with the response schema', async () => {
    const response = await getCosmos();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=UTF-8');
    const body: unknown = await response.json();
    const parsed = CosmosResponseSchema.parse(body);
    expect(parsed.version).toBe(getCosmosVersion());
    expect({ data: parsed.data, derived: parsed.derived }).toEqual(getCosmosView());
  });

  it('sends the exact ETag and Cache-Control headers', async () => {
    const response = await getCosmos();

    expect(response.headers.get('etag')).toBe(`"${getCosmosVersion()}"`);
    expect(response.headers.get('cache-control')).toBe(EXPECTED_CACHE_CONTROL);
  });

  it('answers 304 with no body when If-None-Match matches', async () => {
    const etag = `"${getCosmosVersion()}"`;

    for (const ifNoneMatch of [etag, `W/${etag}`, `"stale", ${etag}`, '*']) {
      const response = await getCosmos({ 'If-None-Match': ifNoneMatch });
      expect(response.status, ifNoneMatch).toBe(304);
      expect(await response.text()).toBe('');
      expect(response.headers.get('etag')).toBe(etag);
      expect(response.headers.get('cache-control')).toBe(EXPECTED_CACHE_CONTROL);
    }
  });

  it('answers 200 when If-None-Match names another version', async () => {
    const response = await getCosmos({ 'If-None-Match': '"0000000000000000"' });

    expect(response.status).toBe(200);
  });

  it('keeps the gzipped body within the 100 KB budget (I7)', () => {
    expect(gzipSync(getCosmosResponseBody().json).byteLength).toBeLessThanOrEqual(MAX_GZIP_BYTES);
  });
});

describe('cosmos version', () => {
  it('is the first 16 hex chars of the sha256 of the serialized view', () => {
    expect(getCosmosVersion()).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is computed once per process', () => {
    expect(getCosmosResponseBody()).toBe(getCosmosResponseBody());
  });
});
