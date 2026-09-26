import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import app from '../app.js';
import { encryptCookiePayload } from '../cookieCrypto.js';

function getStatus(cookieValue?: string): Promise<Response> {
  return Promise.resolve(
    app.request('/api/ai/status', {
      headers: cookieValue ? { Cookie: `cosmos_ai=${cookieValue}` } : {},
    }),
  );
}

function expectCookieCleared(response: Response): void {
  const setCookieHeader = response.headers.get('set-cookie') ?? '';
  expect(setCookieHeader).toMatch(/^cosmos_ai=;/);
  expect(setCookieHeader).toContain('Max-Age=0');
  expect(setCookieHeader).toContain('Path=/api/ai');
}

describe('GET /api/ai/status', () => {
  let secret: Buffer;
  let validCookie: string;
  let providerFetch: Mock<typeof fetch>;

  beforeEach(() => {
    secret = randomBytes(32);
    vi.stubEnv('AI_COOKIE_SECRET', secret.toString('base64'));
    validCookie = encryptCookiePayload({ provider: 'openai', apiKey: 'sk-openai-test' }, secret);
    providerFetch = vi.fn<typeof fetch>(async () => new Response('{"data":[]}', { status: 200 }));
    vi.stubGlobal('fetch', providerFetch);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports disconnected without a cookie and never calls the provider', async () => {
    const response = await getStatus();

    expect(await response.json()).toEqual({ connected: false });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('reports connected while the stored key still works', async () => {
    const response = await getStatus(validCookie);

    expect(await response.json()).toEqual({ connected: true, provider: 'openai' });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('clears the cookie and reports KEY_REVOKED when the provider answers 401', async () => {
    providerFetch.mockResolvedValue(new Response('{}', { status: 401 }));

    const response = await getStatus(validCookie);

    expect(await response.json()).toEqual({ connected: false, reason: 'KEY_REVOKED' });
    expectCookieCleared(response);
  });

  it('stays connected when the provider cannot be reached', async () => {
    providerFetch.mockRejectedValue(new TypeError('fetch failed'));

    const response = await getStatus(validCookie);

    expect(await response.json()).toEqual({ connected: true, provider: 'openai' });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('clears a cookie that fails to decrypt', async () => {
    const foreignCookie = encryptCookiePayload({ provider: 'openai', apiKey: 'sk-openai-test' }, randomBytes(32));

    const response = await getStatus(foreignCookie);

    expect(await response.json()).toEqual({ connected: false });
    expectCookieCleared(response);
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
