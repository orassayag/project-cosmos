import { createLogger } from './logger.js';

export const AI_NOT_CONFIGURED = 'AI_NOT_CONFIGURED';

const COOKIE_SECRET_BYTE_LENGTH = 32;

const logger = createLogger('config');
let hasReportedCookieSecretProblem = false;

function reportCookieSecretProblemOnce(errorCode: string, message: string): void {
  if (hasReportedCookieSecretProblem) {
    return;
  }
  hasReportedCookieSecretProblem = true;
  logger.error(message, { errorCode });
}

/**
 * Returns the AES-256 key for the AI cookie, or null when the cookie routes must
 * answer `503 { errorCode: AI_NOT_CONFIGURED }`. Read per call, never at import,
 * so the app boots (and the map works) without it.
 */
export function getCookieSecret(): Buffer | null {
  const encodedSecret = process.env.AI_COOKIE_SECRET?.trim();
  if (!encodedSecret) {
    reportCookieSecretProblemOnce(AI_NOT_CONFIGURED, 'AI_COOKIE_SECRET is not set; AI cookie routes are disabled');
    return null;
  }
  const secret = Buffer.from(encodedSecret, 'base64');
  if (secret.length !== COOKIE_SECRET_BYTE_LENGTH) {
    reportCookieSecretProblemOnce(
      'AI_COOKIE_SECRET_INVALID',
      `AI_COOKIE_SECRET must decode from base64 to ${COOKIE_SECRET_BYTE_LENGTH} bytes; AI cookie routes are disabled`,
    );
    return null;
  }
  return secret;
}

/** Null means classification must use the free local fallback. */
export function getGatewayApiKey(): string | null {
  return process.env.AI_GATEWAY_API_KEY?.trim() || null;
}
