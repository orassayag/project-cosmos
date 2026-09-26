import { createLogger, type AiProvider } from './logger.js';

export type KeyCheckResult = 'valid' | 'invalid' | 'unavailable';

const ANTHROPIC_API_VERSION = '2023-06-01';
const KEY_CHECK_TIMEOUT_MS = 5000;

const MODELS_ENDPOINTS: Record<AiProvider, string> = {
  anthropic: 'https://api.anthropic.com/v1/models',
  openai: 'https://api.openai.com/v1/models',
};

const logger = createLogger('provider-key-check');

function buildAuthHeaders(provider: AiProvider, apiKey: string): Record<string, string> {
  if (provider === 'anthropic') {
    return { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_API_VERSION };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

/**
 * Lists models (free on both providers) to prove the key works. Only a 401 means
 * the key is bad; any other failure is `unavailable`, so callers can tell a dead
 * key from a provider outage.
 */
export async function checkProviderKey(provider: AiProvider, apiKey: string): Promise<KeyCheckResult> {
  let response: Response;
  try {
    response = await fetch(MODELS_ENDPOINTS[provider], {
      headers: buildAuthHeaders(provider, apiKey),
      signal: AbortSignal.timeout(KEY_CHECK_TIMEOUT_MS),
    });
  } catch {
    // Network/timeout errors can echo request details, so only the code is logged.
    logger.warn('Provider key check could not reach the provider', { errorCode: 'PROVIDER_UNREACHABLE', provider });
    return 'unavailable';
  }
  await response.body?.cancel();
  if (response.status === 401) {
    return 'invalid';
  }
  if (!response.ok) {
    logger.warn('Provider key check got an unexpected status', { errorCode: 'PROVIDER_UNAVAILABLE', provider });
    return 'unavailable';
  }
  return 'valid';
}
