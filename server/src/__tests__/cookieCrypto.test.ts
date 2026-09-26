import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptCookiePayload, encryptCookiePayload, type AiCookiePayload } from '../cookieCrypto.js';

const IV_BYTE_LENGTH = 12;
const AUTH_TAG_BYTE_LENGTH = 16;

const payload: AiCookiePayload = { provider: 'anthropic', apiKey: 'sk-ant-test-key-0123456789' };

function flipByteAt(cookieValue: string, byteIndex: number): string {
  const sealed = Buffer.from(cookieValue, 'base64url');
  sealed[byteIndex] ^= 0xff;
  return sealed.toString('base64url');
}

describe('cookieCrypto', () => {
  let secret: Buffer;

  beforeEach(() => {
    secret = randomBytes(32);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips the payload', () => {
    const cookieValue = encryptCookiePayload(payload, secret);
    expect(cookieValue).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cookieValue).not.toContain(payload.apiKey);
    expect(decryptCookiePayload(cookieValue, secret)).toEqual(payload);
  });

  it('rejects a flipped byte in the ciphertext', () => {
    const cookieValue = encryptCookiePayload(payload, secret);
    expect(decryptCookiePayload(flipByteAt(cookieValue, IV_BYTE_LENGTH), secret)).toBeNull();
  });

  it('rejects a flipped byte in the auth tag', () => {
    const cookieValue = encryptCookiePayload(payload, secret);
    const lastByteIndex = Buffer.from(cookieValue, 'base64url').length - 1;
    expect(decryptCookiePayload(flipByteAt(cookieValue, lastByteIndex), secret)).toBeNull();
    expect(
      decryptCookiePayload(flipByteAt(cookieValue, lastByteIndex - AUTH_TAG_BYTE_LENGTH + 1), secret),
    ).toBeNull();
  });

  it('rejects a cookie sealed under a different secret', () => {
    const cookieValue = encryptCookiePayload(payload, secret);
    expect(decryptCookiePayload(cookieValue, randomBytes(32))).toBeNull();
  });

  it('rejects a truncated cookie', () => {
    expect(decryptCookiePayload('c2hvcnQ', secret)).toBeNull();
  });
});
