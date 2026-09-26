import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// The `ask` → 503 case joins this suite with the /api/ai/ask route (stage 17).
describe('app without AI configuration', () => {
  let app: typeof import('../app.js').default;
  let consoleError: Mock;
  let providerFetch: Mock<typeof fetch>;

  beforeEach(async () => {
    vi.stubEnv('AI_COOKIE_SECRET', undefined);
    vi.stubEnv('AI_GATEWAY_API_KEY', undefined);
    providerFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', providerFetch);
    consoleError = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(consoleError);
    // A fresh module graph resets config's report-once flag between cases.
    vi.resetModules();
    app = (await import('../app.js')).default;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('imports without either env var and logs nothing at import', () => {
    expect(app).toBeDefined();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('answers status with 503 AI_NOT_CONFIGURED', async () => {
    const response = await app.request('/api/ai/status');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: 'AI_NOT_CONFIGURED' });
  });

  it('answers connect with 503 AI_NOT_CONFIGURED without calling the provider', async () => {
    const response = await app.request('/api/ai/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic', apiKey: 'sk-ant-test' }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: 'AI_NOT_CONFIGURED' });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('still lets the client disconnect', async () => {
    const response = await app.request('/api/ai/disconnect', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: false });
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('reports the missing secret once, not per request', async () => {
    await app.request('/api/ai/status');
    await app.request('/api/ai/status');

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(JSON.parse(consoleError.mock.calls[0][0] as string)).toMatchObject({ errorCode: 'AI_NOT_CONFIGURED' });
  });
});
