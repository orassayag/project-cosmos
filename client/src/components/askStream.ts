import type { AskAction } from './AskPanel';

export type AskStreamEvent =
  | { type: 'token'; text: string }
  | AskAction
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'error'; errorCode: string }
  | { type: 'done' };

export const ASK_ERROR_MESSAGES: Record<string, string> = {
  OUT_OF_CREDIT: 'Your AI account is out of credit — top it up with your provider, then ask again.',
  RATE_LIMITED: 'Too many questions at once — try again in a moment.',
  INVALID_KEY: 'Your key no longer works.',
  PROVIDER_ERROR: 'The AI agent hit a problem — please try again.',
  NOT_CONNECTED: 'Your AI agent is no longer connected — connect it again to ask.',
  AI_NOT_CONFIGURED: "AI answers aren't available on this site right now.",
  INVALID_REQUEST: "That question couldn't be sent — try a shorter one.",
  NETWORK_ERROR: "Couldn't reach the AI agent — check your connection and try again.",
};

/** Error codes after which the visitor's stored key is known to be unusable. */
export const DISCONNECTING_ERROR_CODES: ReadonlySet<string> = new Set(['INVALID_KEY', 'NOT_CONNECTED']);

export function toAskErrorMessage(errorCode: string): string {
  return ASK_ERROR_MESSAGES[errorCode] ?? ASK_ERROR_MESSAGES.PROVIDER_ERROR;
}

const tokenCountFormat = new Intl.NumberFormat('en-US');

export function formatUsage(inputTokens: number, outputTokens: number): string {
  return `≈ ${tokenCountFormat.format(inputTokens + outputTokens)} tokens`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Returns null for blank, malformed, or unrecognised lines so one bad line never breaks the answer. */
export function parseAskStreamLine(line: string): AskStreamEvent | null {
  const trimmedLine = line.trim();
  if (trimmedLine === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmedLine);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  switch (parsed.type) {
    case 'token':
      return typeof parsed.text === 'string' ? { type: 'token', text: parsed.text } : null;
    case 'action':
      if (parsed.kind === 'highlight' && Array.isArray(parsed.serviceIds)) {
        const serviceIds = parsed.serviceIds.filter((id): id is string => typeof id === 'string');
        return { type: 'action', kind: 'highlight', serviceIds };
      }
      if (parsed.kind === 'playScenario' && typeof parsed.scenarioId === 'string') {
        return { type: 'action', kind: 'playScenario', scenarioId: parsed.scenarioId };
      }
      return null;
    case 'usage':
      return Number.isFinite(parsed.inputTokens) && Number.isFinite(parsed.outputTokens)
        ? { type: 'usage', inputTokens: parsed.inputTokens as number, outputTokens: parsed.outputTokens as number }
        : null;
    case 'error':
      return typeof parsed.errorCode === 'string' ? { type: 'error', errorCode: parsed.errorCode } : null;
    case 'done':
      return { type: 'done' };
    default:
      return null;
  }
}

export async function readAskStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AskStreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pendingText = '';
  const emitLine = (line: string) => {
    const event = parseAskStreamLine(line);
    if (event) onEvent(event);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pendingText += decoder.decode(value, { stream: true });
    const lines = pendingText.split('\n');
    pendingText = lines.pop() ?? '';
    lines.forEach(emitLine);
  }
  emitLine(pendingText + decoder.decode());
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.errorCode === 'string') return body.errorCode;
  } catch {
    // Non-JSON error page (e.g. a proxy 502) — fall through to the generic code.
  }
  return 'PROVIDER_ERROR';
}

/**
 * POSTs the question and relays each NDJSON event. A pre-stream HTTP failure or
 * a network failure (also mid-stream) is folded into an `error` event; only the
 * first `error` is relayed, and every call that is not aborted ends with exactly
 * one `done`. Once `signal` aborts, nothing more is emitted.
 */
export async function streamAskAnswer(
  question: string,
  signal: AbortSignal,
  onEvent: (event: AskStreamEvent) => void,
): Promise<void> {
  let hasEnded = false;
  let hasErrored = false;
  const relay = (event: AskStreamEvent) => {
    if (signal.aborted || hasEnded) return;
    if (event.type === 'error') {
      if (hasErrored) return;
      hasErrored = true;
    }
    if (event.type === 'done') hasEnded = true;
    onEvent(event);
  };
  try {
    const response = await fetch('/api/ai/ask', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal,
    });
    if (!response.ok || !response.body) {
      relay({ type: 'error', errorCode: response.ok ? 'PROVIDER_ERROR' : await readErrorCode(response) });
    } else {
      await readAskStream(response.body, relay);
    }
  } catch {
    relay({ type: 'error', errorCode: 'NETWORK_ERROR' });
  }
  relay({ type: 'done' });
}

export type EmphasisSegment = { text: string; isEmphasized: boolean };

/** Splits `*x*` / `**x**` runs out of the answer so they render as emphasis instead of raw asterisks. */
export function splitEmphasis(text: string): EmphasisSegment[] {
  const segments: EmphasisSegment[] = [];
  const emphasisPattern = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  let cursor = 0;
  for (const match of text.matchAll(emphasisPattern)) {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index), isEmphasized: false });
    segments.push({ text: match[1] ?? match[2], isEmphasized: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), isEmphasized: false });
  return segments;
}
