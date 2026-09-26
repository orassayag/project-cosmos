import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AskStreamEvent } from '../askStream';
import { formatUsage, parseAskStreamLine, readAskStream, splitEmphasis, streamAskAnswer } from '../askStream';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

async function collect(run: (onEvent: (event: AskStreamEvent) => void) => Promise<void>): Promise<AskStreamEvent[]> {
  const events: AskStreamEvent[] = [];
  await run((event) => events.push(event));
  return events;
}

describe('parseAskStreamLine', () => {
  it('parses every §7 event type', () => {
    expect(parseAskStreamLine('{"type":"token","text":"Hi"}')).toEqual({ type: 'token', text: 'Hi' });
    expect(parseAskStreamLine('{"type":"action","kind":"highlight","serviceIds":["a","b"]}')).toEqual({
      type: 'action',
      kind: 'highlight',
      serviceIds: ['a', 'b'],
    });
    expect(parseAskStreamLine('{"type":"action","kind":"playScenario","scenarioId":"checkout"}')).toEqual({
      type: 'action',
      kind: 'playScenario',
      scenarioId: 'checkout',
    });
    expect(parseAskStreamLine('{"type":"usage","inputTokens":1180,"outputTokens":142}')).toEqual({
      type: 'usage',
      inputTokens: 1180,
      outputTokens: 142,
    });
    expect(parseAskStreamLine('{"type":"error","errorCode":"RATE_LIMITED"}')).toEqual({
      type: 'error',
      errorCode: 'RATE_LIMITED',
    });
    expect(parseAskStreamLine('{"type":"done"}')).toEqual({ type: 'done' });
  });

  it('returns null for blank, malformed, and unknown lines', () => {
    expect(parseAskStreamLine('   ')).toBeNull();
    expect(parseAskStreamLine('{"type":"token","text":')).toBeNull();
    expect(parseAskStreamLine('42')).toBeNull();
    expect(parseAskStreamLine('{"type":"mystery"}')).toBeNull();
    expect(parseAskStreamLine('{"type":"token","text":7}')).toBeNull();
  });
});

describe('readAskStream', () => {
  it('reassembles lines split across chunks and skips bad lines', async () => {
    const events = await collect((onEvent) =>
      readAskStream(
        streamOf(['{"type":"tok', 'en","text":"A"}\n\nnot json\n{"type":"token","text":"B"}\n{"type":"do', 'ne"}']),
        onEvent,
      ),
    );
    expect(events).toEqual([{ type: 'token', text: 'A' }, { type: 'token', text: 'B' }, { type: 'done' }]);
  });
});

describe('streamAskAnswer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('turns a non-2xx response into its errorCode followed by done', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ errorCode: 'NOT_CONNECTED' }, { status: 401 })));
    const events = await collect((onEvent) => streamAskAnswer('q', new AbortController().signal, onEvent));
    expect(events).toEqual([{ type: 'error', errorCode: 'NOT_CONNECTED' }, { type: 'done' }]);
  });

  it('turns a network failure into NETWORK_ERROR followed by done', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    const events = await collect((onEvent) => streamAskAnswer('q', new AbortController().signal, onEvent));
    expect(events).toEqual([{ type: 'error', errorCode: 'NETWORK_ERROR' }, { type: 'done' }]);
  });

  it('emits exactly one done and only the first error', async () => {
    const body = '{"type":"error","errorCode":"INVALID_KEY"}\n{"type":"error","errorCode":"PROVIDER_ERROR"}\n{"type":"done"}\n';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(streamOf([body]))));
    const events = await collect((onEvent) => streamAskAnswer('q', new AbortController().signal, onEvent));
    expect(events).toEqual([{ type: 'error', errorCode: 'INVALID_KEY' }, { type: 'done' }]);
  });

  it('emits nothing once aborted', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    }));
    const events = await collect((onEvent) => streamAskAnswer('q', controller.signal, onEvent));
    expect(events).toEqual([]);
  });
});

describe('splitEmphasis', () => {
  it('turns *Title* and **Title** into emphasis without raw asterisks', () => {
    expect(splitEmphasis('Playing *Checkout* for you ▶')).toEqual([
      { text: 'Playing ', isEmphasized: false },
      { text: 'Checkout', isEmphasized: true },
      { text: ' for you ▶', isEmphasized: false },
    ]);
    expect(splitEmphasis('**bold**')).toEqual([{ text: 'bold', isEmphasized: true }]);
  });
});

describe('formatUsage', () => {
  it('sums input and output tokens with thousands separators', () => {
    expect(formatUsage(1180, 142)).toBe('≈ 1,322 tokens');
  });
});
