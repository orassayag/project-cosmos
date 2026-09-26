import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { AskPanel } from '../AskPanel';
import type { AskAction } from '../AskPanel';
import { OVERLAY, OverlayProvider, useOverlayManager } from '../../overlays/OverlayManager';
import { useAiConnection } from '../../hooks/useAiConnection';

const CONNECT_PROMPT = 'Connect an AI agent for real answers.';

function Harness({ showConnectPrompt }: { showConnectPrompt: boolean }) {
  const overlay = useOverlayManager();
  return (
    <OverlayProvider value={overlay}>
      <output data-testid="active-overlay">{overlay.active ?? 'none'}</output>
      <AskPanel
        question="Which team owns checkout?"
        onClose={() => overlay.close(OVERLAY.ask)}
        showConnectPrompt={showConnectPrompt}
        onConnectRequest={() => overlay.open(OVERLAY.connect)}
      />
    </OverlayProvider>
  );
}

function finishJokeAnswer() {
  for (let tick = 0; tick < 200; tick += 1) {
    act(() => {
      vi.advanceTimersByTime(100);
    });
  }
}

describe('AskPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ends the joke answer with a Connect prompt that opens the connect modal', () => {
    render(<Harness showConnectPrompt />);

    expect(screen.queryByRole('button', { name: CONNECT_PROMPT })).toBeNull();
    finishJokeAnswer();

    fireEvent.click(screen.getByRole('button', { name: CONNECT_PROMPT }));

    expect(screen.getByTestId('active-overlay').textContent).toBe(OVERLAY.connect);
  });

  it('shows no Connect prompt when an agent is connected', () => {
    render(<Harness showConnectPrompt={false} />);

    finishJokeAnswer();

    expect(screen.getByText(/./, { selector: '.lc-ask-answer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: CONNECT_PROMPT })).toBeNull();
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
    if (url === '/api/ai/disconnect' && init?.method === 'POST') return Response.json({ connected: false });
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
          onClose={() => undefined}
          isAiConnected={aiConnection.status === 'connected'}
          showConnectPrompt={aiConnection.status === 'disconnected'}
          onConnectRequest={() => undefined}
          onAnswerStart={onAnswerStart}
          onAction={onAction}
          onKeyRejected={() => void aiConnection.disconnect()}
        />
      )}
    </>
  );
}

describe('AskPanel (connected)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('logs out exactly once when the stream reports INVALID_KEY', async () => {
    const fetchMock = stubAiServer([{ type: 'error', errorCode: 'INVALID_KEY' }, { type: 'done' }]);
    render(<ConnectedHarness />);

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Your key no longer works.');
    await waitFor(() => expect(screen.getByTestId('ai-status').textContent).toBe('disconnected'));
    expect(callsTo(fetchMock, '/api/ai/disconnect')).toHaveLength(1);
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
    expect(callsTo(fetchMock, '/api/ai/disconnect')).toHaveLength(0);
  });

  it('shows no usage line for an off-topic reply', async () => {
    stubAiServer([{ type: 'token', text: 'I only know about this map, sorry!' }, { type: 'done' }]);
    render(<ConnectedHarness />);

    expect(await screen.findByText('I only know about this map, sorry!')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('.lc-ask-caret')).toBeNull());
    expect(document.querySelector('.lc-ask-usage')).toBeNull();
    expect(screen.queryByText(/Connect an AI agent/)).toBeNull();
  });
});
