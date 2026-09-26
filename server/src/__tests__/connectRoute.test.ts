import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import app from '../app.js';
import { decryptCookiePayload } from '../cookieCrypto.js';

const API_KEY = 'sk-ant-test-key-0123456789';

function postConnect(body: unknown): Promise<Response> {
  return Promise.resolve(
    app.request('/api/ai/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

describe('POST /api/ai/connect', () => {
  let secret: Buffer;
  let providerFetch: Mock<typeof fetch>;
  let consoleOutput: Mock;

  beforeEach(() => {
    secret = randomBytes(32);
    vi.stubEnv('AI_COOKIE_SECRET', secret.toString('base64'));
    providerFetch = vi.fn<typeof fetch>(async () => new Response('{"data":[]}', { status: 200 }));
    vi.stubGlobal('fetch', providerFetch);
    consoleOutput = vi.fn();
    vi.spyOn(console, 'log').mockImplementation(consoleOutput);
    vi.spyOn(console, 'warn').mockImplementation(consoleOutput);
    vi.spyOn(console, 'error').mockImplementation(consoleOutput);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stores a working key in a locked-down encrypted cookie', async () => {
    const response = await postConnect({ provider: 'anthropic', apiKey: API_KEY });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: true, provider: 'anthropic' });

    const [requestUrl, requestInit] = providerFetch.mock.calls[0];
    expect(requestUrl).toBe('https://api.anthropic.com/v1/models');
    expect(new Headers(requestInit?.headers).get('x-api-key')).toBe(API_KEY);

    const setCookieHeader = response.headers.get('set-cookie') ?? '';
    expect(setCookieHeader).toMatch(/^cosmos_ai=/);
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('Secure');
    expect(setCookieHeader).toContain('SameSite=Strict');
    expect(setCookieHeader).toContain('Path=/api/ai');
    expect(setCookieHeader).toContain('Max-Age=2592000');
    expect(setCookieHeader).not.toContain(API_KEY);

    const cookieValue = setCookieHeader.split(';')[0].slice('cosmos_ai='.length);
    expect(decryptCookiePayload(cookieValue, secret)).toEqual({ provider: 'anthropic', apiKey: API_KEY });
  });

  it('seals an optional gateway key into the same cookie, never echoing it', async () => {
    const response = await postConnect({ provider: 'anthropic', apiKey: API_KEY, gatewayApiKey: '  vck_gateway_key  ' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: true, provider: 'anthropic' });
    const setCookieHeader = response.headers.get('set-cookie') ?? '';
    expect(setCookieHeader).not.toContain('vck_gateway_key');
    const cookieValue = setCookieHeader.split(';')[0].slice('cosmos_ai='.length);
    expect(decryptCookiePayload(cookieValue, secret)).toEqual({
      provider: 'anthropic',
      apiKey: API_KEY,
      gatewayApiKey: 'vck_gateway_key',
    });
  });

  it('treats a blank gateway key as not given', async () => {
    const response = await postConnect({ provider: 'anthropic', apiKey: API_KEY, gatewayApiKey: '   ' });

    const cookieValue = (response.headers.get('set-cookie') ?? '').split(';')[0].slice('cosmos_ai='.length);
    expect(decryptCookiePayload(cookieValue, secret)).toEqual({ provider: 'anthropic', apiKey: API_KEY });
  });

  it('rejects a gateway key that is not a string', async () => {
    const response = await postConnect({ provider: 'anthropic', apiKey: API_KEY, gatewayApiKey: 42 });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'INVALID_REQUEST', field: 'gatewayApiKey' });
  });

  it('checks OpenAI keys with a bearer token', async () => {
    const response = await postConnect({ provider: 'openai', apiKey: 'sk-openai-test' });

    expect(response.status).toBe(200);
    const [requestUrl, requestInit] = providerFetch.mock.calls[0];
    expect(requestUrl).toBe('https://api.openai.com/v1/models');
    expect(new Headers(requestInit?.headers).get('authorization')).toBe('Bearer sk-openai-test');
  });

  it('rejects a key the provider answers 401 for and sets no cookie', async () => {
    providerFetch.mockResolvedValue(new Response('{}', { status: 401 }));

    const response = await postConnect({ provider: 'anthropic', apiKey: API_KEY });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ errorCode: 'INVALID_KEY' });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(JSON.stringify(consoleOutput.mock.calls)).not.toContain(API_KEY);
  });

  it('reports a provider outage without storing the key', async () => {
    providerFetch.mockRejectedValue(new TypeError(`fetch failed for ${API_KEY}`));

    const response = await postConnect({ provider: 'anthropic', apiKey: API_KEY });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ errorCode: 'PROVIDER_UNAVAILABLE' });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(JSON.stringify(consoleOutput.mock.calls)).not.toContain(API_KEY);
  });

  it.each([
    [{ provider: 'gemini', apiKey: API_KEY }, 'provider'],
    [{ provider: 'anthropic', apiKey: '   ' }, 'apiKey'],
    [{ provider: 'anthropic' }, 'apiKey'],
    ['not json', 'body'],
  ])('names the invalid field for body %j', async (body, expectedField) => {
    const response = await postConnect(body);

    expect(response.status).toBe(400);
    const responseBody = (await response.json()) as { message: string };
    expect(responseBody).toMatchObject({ errorCode: 'INVALID_REQUEST', field: expectedField });
    expect(responseBody.message).toContain(expectedField === 'body' ? 'JSON' : expectedField);
    expect(providerFetch).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
