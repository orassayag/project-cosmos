export const PROVIDER_ERROR_CODES = ['OUT_OF_CREDIT', 'RATE_LIMITED', 'INVALID_KEY', 'PROVIDER_ERROR'] as const;
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export class ProviderError extends Error {
  readonly errorCode: ProviderErrorCode;

  constructor(message: string, context: { errorCode: ProviderErrorCode; cause?: unknown }) {
    super(message, { cause: context.cause });
    this.name = 'ProviderError';
    this.errorCode = context.errorCode;
  }
}

const ANTHROPIC_OUT_OF_CREDIT_PHRASE = 'credit balance is too low';
const OPENAI_OUT_OF_CREDIT_CODE = 'insufficient_quota';
const MAX_CAUSE_DEPTH = 5;

// LangChain may re-wrap SDK errors; these are its documented codes for the statuses the table cares about.
const LANGCHAIN_STATUS_BY_ERROR_CODE: Readonly<Record<string, number>> = {
  MODEL_AUTHENTICATION: 401,
  MODEL_RATE_LIMIT: 429,
};

// Deliberately generic: provider messages can echo part of the visitor's key (OpenAI's 401 does).
const SAFE_MESSAGES: Readonly<Record<ProviderErrorCode, string>> = {
  OUT_OF_CREDIT: 'The AI provider account is out of credit',
  RATE_LIMITED: 'The AI provider rate-limited the request',
  INVALID_KEY: 'The AI provider rejected the API key',
  PROVIDER_ERROR: 'The AI provider request failed',
};

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields | undefined {
  return typeof value === 'object' && value !== null ? (value as Fields) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

interface ErrorFacts {
  status: number | undefined;
  codes: string[];
  messages: string[];
}

// Anthropic: `status` + body `error.error.message`. OpenAI: `status` + `code` (mirrors `error.code`).
function readFacts(error: Fields): ErrorFacts {
  const body = asFields(error.error);
  const nestedBody = asFields(body?.error);
  const response = asFields(error.response);
  const langchainCode = asString(error.lc_error_code);
  const status =
    asNumber(error.status) ??
    asNumber(error.statusCode) ??
    asNumber(response?.status) ??
    (langchainCode ? LANGCHAIN_STATUS_BY_ERROR_CODE[langchainCode] : undefined);
  const codes = [error.code, body?.code, nestedBody?.code].map(asString).filter((code) => code !== undefined);
  const messages = [error.message, body?.message, nestedBody?.message]
    .map(asString)
    .filter((message) => message !== undefined);
  return { status, codes, messages };
}

function classifyFacts({ status, codes, messages }: ErrorFacts): ProviderErrorCode | undefined {
  if (status === 400 && messages.some((message) => message.toLowerCase().includes(ANTHROPIC_OUT_OF_CREDIT_PHRASE))) {
    return 'OUT_OF_CREDIT';
  }
  if (status === 429) {
    return codes.includes(OPENAI_OUT_OF_CREDIT_CODE) ? 'OUT_OF_CREDIT' : 'RATE_LIMITED';
  }
  if (status === 401) {
    return 'INVALID_KEY';
  }
  return undefined;
}

/** Maps any error thrown by a provider SDK (or a wrapper around one) to the errorCode the client understands. */
export function mapProviderError(error: unknown): ProviderErrorCode {
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth++) {
    if (current instanceof ProviderError) return current.errorCode;
    const fields = asFields(current);
    if (!fields) break;
    const errorCode = classifyFacts(readFacts(fields));
    if (errorCode) return errorCode;
    current = fields.cause;
  }
  return 'PROVIDER_ERROR';
}

export function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const errorCode = mapProviderError(error);
  return new ProviderError(SAFE_MESSAGES[errorCode], { errorCode, cause: error });
}
