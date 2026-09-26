import { describe, expect, it } from 'vitest';
import { mapProviderError, ProviderError, toProviderError, type ProviderErrorCode } from '../providerErrors.js';

// Shapes follow the documented SDK errors: Anthropic APIError (`status`, `error` = response body,
// `message` = "<status> <body json>") and OpenAI APIError (`status`, `code`, `error` = inner error object).
function anthropicError(status: number, type: string, message: string) {
  const body = { type: 'error', error: { type, message } };
  return Object.assign(new Error(`${status} ${JSON.stringify(body)}`), { status, error: body });
}

function openAiError(status: number, code: string | null, message: string) {
  const inner = { message, type: 'error', code, param: null };
  return Object.assign(new Error(`${status} ${message}`), { status, code, error: inner });
}

const CASES: { name: string; error: unknown; expected: ProviderErrorCode }[] = [
  {
    name: 'Anthropic 400 "credit balance is too low" → OUT_OF_CREDIT',
    error: anthropicError(
      400,
      'invalid_request_error',
      'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
    ),
    expected: 'OUT_OF_CREDIT',
  },
  {
    name: 'OpenAI 429 insufficient_quota → OUT_OF_CREDIT',
    error: openAiError(429, 'insufficient_quota', 'You exceeded your current quota, please check your plan and billing details.'),
    expected: 'OUT_OF_CREDIT',
  },
  {
    name: 'OpenAI 429 without insufficient_quota → RATE_LIMITED',
    error: openAiError(429, 'rate_limit_exceeded', 'Rate limit reached for requests'),
    expected: 'RATE_LIMITED',
  },
  {
    name: 'Anthropic 429 → RATE_LIMITED',
    error: anthropicError(429, 'rate_limit_error', 'Number of request tokens has exceeded your per-minute rate limit'),
    expected: 'RATE_LIMITED',
  },
  {
    name: 'Anthropic 401 → INVALID_KEY',
    error: anthropicError(401, 'authentication_error', 'invalid x-api-key'),
    expected: 'INVALID_KEY',
  },
  {
    name: 'OpenAI 401 → INVALID_KEY',
    error: openAiError(401, 'invalid_api_key', 'Incorrect API key provided: sk-abc***xyz.'),
    expected: 'INVALID_KEY',
  },
  {
    name: 'Anthropic 400 for another reason → PROVIDER_ERROR',
    error: anthropicError(400, 'invalid_request_error', 'max_tokens: must be positive'),
    expected: 'PROVIDER_ERROR',
  },
  {
    name: 'Anthropic 529 overloaded → PROVIDER_ERROR',
    error: anthropicError(529, 'overloaded_error', 'Overloaded'),
    expected: 'PROVIDER_ERROR',
  },
  { name: 'network error with no status → PROVIDER_ERROR', error: new TypeError('fetch failed'), expected: 'PROVIDER_ERROR' },
  { name: 'non-error value → PROVIDER_ERROR', error: 'boom', expected: 'PROVIDER_ERROR' },
];

describe('mapProviderError', () => {
  it.each(CASES)('$name', ({ error, expected }) => {
    expect(mapProviderError(error)).toBe(expected);
  });

  it('reads through a wrapper whose cause is the SDK error', () => {
    const wrapped = new Error('model call failed', { cause: openAiError(429, 'insufficient_quota', 'quota') });
    expect(mapProviderError(wrapped)).toBe('OUT_OF_CREDIT');
  });

  it('keeps the errorCode of an existing ProviderError', () => {
    expect(mapProviderError(new ProviderError('x', { errorCode: 'RATE_LIMITED' }))).toBe('RATE_LIMITED');
  });
});

describe('toProviderError', () => {
  it('wraps with the mapped errorCode, keeps the cause, and never echoes the provider message', () => {
    const original = openAiError(401, 'invalid_api_key', 'Incorrect API key provided: sk-abc***xyz.');
    const providerError = toProviderError(original);
    expect(providerError).toBeInstanceOf(ProviderError);
    expect(providerError.errorCode).toBe('INVALID_KEY');
    expect(providerError.cause).toBe(original);
    expect(providerError.message).not.toContain('sk-');
  });
});
