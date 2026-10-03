import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import app from '../app.js';

describe('GET /api/ai/status', () => {
  let providerFetch: Mock<typeof fetch>;

  beforeEach(() => {
    vi.stubEnv('VERCEL', undefined);
    vi.stubEnv('COSMOS_LOCAL_AGENT', '1');
    vi.stubEnv('ANTHROPIC_API_KEY', undefined);
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-test');
    providerFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', providerFetch);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports connected with the env provider and never calls the provider', async () => {
    const response = await app.request('/api/ai/status');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: true, provider: 'openai' });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('answers 503 AI_NOT_LOCAL when deployed', async () => {
    vi.stubEnv('VERCEL', '1');

    const response = await app.request('/api/ai/status');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: 'AI_NOT_LOCAL' });
  });

  it('answers 503 AI_NOT_LOCAL without the local flag', async () => {
    vi.stubEnv('COSMOS_LOCAL_AGENT', undefined);

    const response = await app.request('/api/ai/status');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: 'AI_NOT_LOCAL' });
  });

  it('answers 503 AI_NOT_CONFIGURED when local with no key', async () => {
    vi.stubEnv('OPENAI_API_KEY', undefined);

    const response = await app.request('/api/ai/status');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: 'AI_NOT_CONFIGURED' });
  });

  it('never sets a cookie', async () => {
    const response = await app.request('/api/ai/status', { headers: { Cookie: 'cosmos_ai=stale' } });

    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each(['/api/ai/connect', '/api/ai/disconnect'])('no longer serves %s', async (path) => {
    const response = await app.request(path, { method: 'POST' });

    expect(response.status).toBe(404);
  });
});
