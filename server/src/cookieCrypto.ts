import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { setCookie } from 'hono/cookie';
import { AI_PROVIDERS, createLogger, type AiProvider } from './logger.js';

export interface AiCookiePayload {
  provider: AiProvider;
  apiKey: string;
}

export const AI_COOKIE_NAME = 'cosmos_ai';

export const AI_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  path: '/api/ai',
  maxAge: 2592000,
} as const satisfies NonNullable<Parameters<typeof setCookie>[3]>;

const CIPHER_ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;
const AUTH_TAG_BYTE_LENGTH = 16;

const logger = createLogger('cookie-crypto');

function isAiCookiePayload(value: unknown): value is AiCookiePayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { provider, apiKey } = value as Record<string, unknown>;
  return (
    AI_PROVIDERS.includes(provider as AiProvider) && typeof apiKey === 'string' && apiKey.length > 0
  );
}

/** Returns `base64url(iv ‖ ciphertext ‖ authTag)`. */
export function encryptCookiePayload(payload: AiCookiePayload, secret: Buffer): string {
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(CIPHER_ALGORITHM, secret, iv, { authTagLength: AUTH_TAG_BYTE_LENGTH });
  const plaintext = JSON.stringify({ provider: payload.provider, apiKey: payload.apiKey });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString('base64url');
}

/**
 * Returns null for any cookie that is truncated, tampered with, sealed under
 * another secret, or not a valid payload — callers treat null as "not connected".
 */
export function decryptCookiePayload(cookieValue: string, secret: Buffer): AiCookiePayload | null {
  const sealed = Buffer.from(cookieValue, 'base64url');
  if (sealed.length <= IV_BYTE_LENGTH + AUTH_TAG_BYTE_LENGTH) {
    logger.warn('AI cookie is too short to be valid', { errorCode: 'AI_COOKIE_REJECTED' });
    return null;
  }
  const iv = sealed.subarray(0, IV_BYTE_LENGTH);
  const authTag = sealed.subarray(sealed.length - AUTH_TAG_BYTE_LENGTH);
  const ciphertext = sealed.subarray(IV_BYTE_LENGTH, sealed.length - AUTH_TAG_BYTE_LENGTH);
  try {
    const decipher = createDecipheriv(CIPHER_ALGORITHM, secret, iv, { authTagLength: AUTH_TAG_BYTE_LENGTH });
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const payload: unknown = JSON.parse(plaintext);
    if (!isAiCookiePayload(payload)) {
      logger.warn('AI cookie decrypted to an unexpected shape', { errorCode: 'AI_COOKIE_REJECTED' });
      return null;
    }
    return { provider: payload.provider, apiKey: payload.apiKey };
  } catch {
    // GCM authentication failure (tampered bytes or wrong secret); the error text carries nothing useful to log.
    logger.warn('AI cookie failed authentication', { errorCode: 'AI_COOKIE_REJECTED' });
    return null;
  }
}
