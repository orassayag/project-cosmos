import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { AskPanel } from '../AskPanel';
import type { AskAction } from '../AskPanel';
import { useAiConnection } from '../../hooks/useAiConnection';

describe('AskPanel (question box)', () => {
  it('shows only the question box before anything is asked, and never fetches', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<AskPanel question="" onAsk={vi.fn()} onClose={() => undefined} />);

    expect(screen.getByRole('textbox', { name: 'Your question' })).toBeTruthy();
    expect(document.querySelector('.lc-ask-panel-question')).toBeNull();
    expect(screen.queryByLabelText('Thinking')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('asks the trimmed question on Search and on Enter, and ignores a blank one', () => {
    const onAsk = vi.fn();
    render(<AskPanel question="" onAsk={onAsk} onClose={() => undefined} />);
    const field = screen.getByRole('textbox', { name: 'Your question' });

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onAsk).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: '  Who owns checkout?  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(onAsk).toHaveBeenCalledTimes(2);
    expect(onAsk).toHaveBeenNthCalledWith(1, 'Who owns checkout?');
    expect(onAsk).toHaveBeenNthCalledWith(2, 'Who owns checkout?');
  });
});

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function ndjsonResponse(lines: object[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      lines.forEach((line) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`)));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } });
}

function stubAiServer(askLines: object[]) {
  const fetchMock = vi.fn(async (input: FetchInput, init?: FetchInit) => {
    const url = String(input);
    if (url === '/api/ai/status') return Response.json({ connected: true, provider: 'anthropic' });
    if (url === '/api/ai/ask' && init?.method === 'POST') return ndjsonResponse(askLines);
    throw new Error(`Unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function callsTo(fetchMock: ReturnType<typeof stubAiServer>, url: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input) === url);
}

function ConnectedHarness({ onAction, onAnswerStart }: { onAction?: (action: AskAction) => void; onAnswerStart?: () => void }) {
  const aiConnection = useAiConnection();
  const [hasAsked, setHasAsked] = useState(false);
  useEffect(() => {
    if (aiConnection.status === 'connected') setHasAsked(true);
  }, [aiConnection.status]);
  return (
    <>
      <output data-testid="ai-status">{aiConnection.status}</output>
      {hasAsked && (
        <AskPanel
          question="What happens when a payment fails?"
          onAsk={() => undefined}
          onClose={() => undefined}
          onAnswerStart={onAnswerStart}
          onAction={onAction}
        />
      )}
    </>
  );
}

describe('AskPanel (connected)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the "key was refused" text and stays connected when the provider rejects the key', async () => {
    const fetchMock = stubAiServer([{ type: 'error', errorCode: 'INVALID_KEY' }, { type: 'done' }]);
    render(<ConnectedHarness />);

    expect((await screen.findByRole('alert')).textContent).toMatch(/refused the key/);
    expect(screen.getByTestId('ai-status').textContent).toBe('connected');
    expect(callsTo(fetchMock, '/api/ai/status')).toHaveLength(1);
    expect(callsTo(fetchMock, '/api/ai/ask')).toHaveLength(1);
  });

  it('streams tokens, forwards actions, and shows the usage line', async () => {
    const highlight = { type: 'action', kind: 'highlight', serviceIds: ['checkout', 'payments-gateway'] };
    const fetchMock = stubAiServer([
      { type: 'token', text: 'The checkout flow ' },
      highlight,
      { type: 'token', text: 'starts at *Checkout*.' },
      { type: 'usage', inputTokens: 1180, outputTokens: 142 },
      { type: 'done' },
    ]);
    const onAction = vi.fn();
    const onAnswerStart = vi.fn();
    render(<ConnectedHarness onAction={onAction} onAnswerStart={onAnswerStart} />);

    expect(await screen.findByText('≈ 1,322 tokens')).toBeTruthy();
    const answer = document.querySelector('.lc-ask-answer');
    expect(answer?.textContent).toBe('The checkout flow starts at Checkout.');
    expect(answer?.querySelector('em')?.textContent).toBe('Checkout');
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(highlight);
    expect(onAnswerStart).toHaveBeenCalledTimes(1);
    const [, askInit] = callsTo(fetchMock, '/api/ai/ask')[0];
    expect(JSON.parse(String(askInit?.body))).toEqual({ question: 'What happens when a payment fails?' });
  });

  it('shows no usage line for an off-topic reply', async () => {
    stubAiServer([{ type: 'token', text: 'I only know about this map, sorry!' }, { type: 'done' }]);
    render(<ConnectedHarness />);

    expect(await screen.findByText('I only know about this map, sorry!')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('.lc-ask-caret')).toBeNull());
    expect(document.querySelector('.lc-ask-usage')).toBeNull();
  });
});

describe('AskPanel (scripted answer)', () => {
  const highlight: AskAction = { type: 'action', kind: 'highlight', serviceIds: ['checkout', 'payments-gateway'] };
  const scriptedAnswer = {
    text: 'Checkout calls the *Payments Gateway* first.',
    thinkingMs: 1500,
    wordMs: 90,
    actions: [highlight],
  };
  const wordTotal = scriptedAnswer.text.split(' ').length;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function advance(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  it('plays the exact text on a fixed pace, fires the highlight as it starts, and never fetches', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const onAction = vi.fn();
    const onAnswerStart = vi.fn();
    render(
      <AskPanel
        question="What happens when a payment fails?"
        onAsk={() => undefined}
        onClose={() => undefined}
        onAction={onAction}
        onAnswerStart={onAnswerStart}
        scriptedAnswer={scriptedAnswer}
      />,
    );

    advance(scriptedAnswer.thinkingMs - 1);
    expect(screen.getByLabelText('Thinking')).toBeTruthy();
    expect(onAction).not.toHaveBeenCalled();

    advance(1);
    expect(onAnswerStart).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(highlight);

    advance(wordTotal * scriptedAnswer.wordMs - 1);
    expect(document.querySelector('.lc-ask-caret')).not.toBeNull();

    advance(1);
    const answer = document.querySelector('.lc-ask-answer');
    expect(answer?.textContent).toBe('Checkout calls the Payments Gateway first.');
    expect(answer?.querySelector('em')?.textContent).toBe('Payments Gateway');
    expect(document.querySelector('.lc-ask-caret')).toBeNull();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stops the scripted answer when unmounted mid-answer', () => {
    const onAction = vi.fn();
    const { unmount } = render(
      <AskPanel question="Q" onAsk={() => undefined} onClose={() => undefined} onAction={onAction} scriptedAnswer={scriptedAnswer} />,
    );
    advance(scriptedAnswer.thinkingMs / 2);
    unmount();
    advance(scriptedAnswer.thinkingMs + wordTotal * scriptedAnswer.wordMs);
    expect(onAction).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
