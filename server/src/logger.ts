export const AI_PROVIDERS = ['anthropic', 'openai'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export interface LogFields {
  errorCode: string;
  provider?: AiProvider;
}

export interface Logger {
  info(message: string, fields: LogFields): void;
  warn(message: string, fields: LogFields): void;
  error(message: string, fields: LogFields): void;
}

type LogLevel = 'info' | 'warn' | 'error';

function writeLogLine(level: LogLevel, scope: string, message: string, fields: LogFields): void {
  // Fields are copied by name, never spread, so a caller passing a wider object
  // (a request, a body, a cookie) cannot leak anything beyond these keys.
  const logLine = JSON.stringify({
    level,
    scope,
    message,
    errorCode: fields.errorCode,
    provider: fields.provider,
    noPHI: true,
    time: new Date().toISOString(),
  });
  if (level === 'error') {
    console.error(logLine);
  } else if (level === 'warn') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }
}

export function createLogger(scope: string): Logger {
  return {
    info: (message, fields) => writeLogLine('info', scope, message, fields),
    warn: (message, fields) => writeLogLine('warn', scope, message, fields),
    error: (message, fields) => writeLogLine('error', scope, message, fields),
  };
}
