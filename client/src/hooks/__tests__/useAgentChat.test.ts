import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createElement, useState } from 'react';
import type { ChatMessage } from '../../api/chatHistory';
import { ASK_ERROR_MESSAGES } from '../../components/askStream';
import { useAiConnection } from '../useAiConnection';
import { STOPPED_REPLY_NOTE, toChatHistory, useAgentChat, type AgentChat, type AgentChatMessage } from '../useAgentChat';

interface FakeAskRequest {
  messages: ChatMessage[];
  signal: AbortSignal;
  respond: () => void;
  respondWithError: (status: number, errorCode: string) => void;
  push: (event: object) => void;
  finish: () => void;
}

function installFakeFetch() {
  const requests: FakeAskRequest[] = [];
  const encoder = new TextEncoder();
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    if (url === '/api/ai/status') return Promise.resolve(Response.json({ connected: true, provider: 'anthropic' }));
    const signal = init.signal as AbortSignal;
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    return new Promise<Response>((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const abortError = new DOMException('Aborted', 'AbortError');
        reject(abortError);
        streamController.error(abortError);
      });
      requests.push({
        messages: (JSON.parse(init.body as string) as { messages: ChatMessage[] }).messages,
        signal,
        respond: () => resolve(new Response(body)),
        respondWithError: (status, errorCode) => resolve(Response.json({ errorCode }, { status })),
        push: (event) => streamController.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
        finish: () => streamController.close(),
      });
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return requests;
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function replies(messages: AgentChatMessage[]) {
  return messages.filter((message) => message.role === 'assistant');
}

describe('useAgentChat', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the question as { messages } and streams the reply into state', async () => {
    const requests = installFakeFetch();
    const { result } = renderHook(() => useAgentChat());

    act(() => result.current.send('  What does checkout call?  '));
    expect(result.current.isStreaming).toBe(true);
    expect(requests[0].messages).toEqual([{ role: 'user', content: 'What does checkout call?' }]);

    await act(async () => requests[0].respond());
    await act(async () => {
      requests[0].push({ type: 'token', text: 'Payments ' });
      requests[0].push({ type: 'token', text: 'and cart.' });
      requests[0].push({ type: 'done' });
      requests[0].finish();
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(replies(result.current.messages)).toMatchObject([{ content: 'Payments and cart.', status: 'done' }]);
  });

  it('sends a stop-before-first-chunk reply back as the marker, keeping a valid request', async () => {
    const requests = installFakeFetch();
    const { result } = renderHook(() => useAgentChat());

    act(() => result.current.send('Who owns payments?'));
    act(() => result.current.stop());

    expect(requests[0].signal.aborted).toBe(true);
    expect(result.current.isStreaming).toBe(false);
    expect(replies(result.current.messages)).toMatchObject([{ content: '', status: 'stopped' }]);

    act(() => result.current.send('And who owns cart?'));

    expect(requests[1].messages).toEqual([
      { role: 'user', content: 'Who owns payments?' },
      { role: 'assistant', content: STOPPED_REPLY_NOTE },
      { role: 'user', content: 'And who owns cart?' },
    ]);
  });

  it('appends the marker after a partial stopped reply', () => {
    const history = toChatHistory([
      { id: '1', role: 'user', content: 'q' },
      { id: '2', role: 'assistant', content: 'Half an answer ', status: 'stopped', usage: null },
    ]);
    expect(history[1]).toEqual({ role: 'assistant', content: `Half an answer\n\n${STOPPED_REPLY_NOTE}` });
  });

  it('aborts on new chat and never lets a late chunk into the fresh chat', async () => {
    const requests = installFakeFetch();
    const { result } = renderHook(() => useAgentChat());

    act(() => result.current.send('What breaks if payments goes down?'));
    await act(async () => requests[0].respond());
    await act(async () => requests[0].push({ type: 'token', text: 'Checkout ' }));
    expect(replies(result.current.messages)[0].content).toBe('Checkout ');

    act(() => result.current.newChat());
    expect(requests[0].signal.aborted).toBe(true);

    await act(async () => {
      try {
        requests[0].push({ type: 'token', text: 'late chunk' });
      } catch {
        // The aborted stream refuses the chunk, which is exactly what a real fetch does.
      }
    });
    await flush();

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
  });

  it('keeps streaming into state after the window that shows it unmounts', async () => {
    const requests = installFakeFetch();
    let chat!: AgentChat;
    let closeWindow!: () => void;
    function ChatWindow({ messages }: { messages: AgentChatMessage[] }) {
      return createElement('ol', { 'data-testid': 'chat-window' }, `${messages.length}`);
    }
    function Host() {
      chat = useAgentChat();
      const [isWindowOpen, setIsWindowOpen] = useState(true);
      closeWindow = () => setIsWindowOpen(false);
      return isWindowOpen ? createElement(ChatWindow, { messages: chat.messages }) : null;
    }
    render(createElement(Host));

    act(() => chat.send('Show me the checkout flow'));
    await act(async () => requests[0].respond());
    act(() => closeWindow());
    expect(screen.queryByTestId('chat-window')).toBeNull();
    await act(async () => {
      requests[0].push({ type: 'token', text: 'Here it is.' });
      requests[0].push({ type: 'done' });
      requests[0].finish();
    });

    await waitFor(() => expect(chat.isStreaming).toBe(false));
    expect(requests[0].signal.aborted).toBe(false);
    expect(replies(chat.messages)).toMatchObject([{ content: 'Here it is.', status: 'done' }]);
  });

  it('turns a 401 into an error message with the provider text while the bot stays green', async () => {
    const requests = installFakeFetch();
    const { result } = renderHook(() => ({ chat: useAgentChat(), connection: useAiConnection() }));
    await waitFor(() => expect(result.current.connection.status).toBe('connected'));

    act(() => result.current.chat.send('Who owns payments?'));
    await act(async () => requests[0].respondWithError(401, 'INVALID_KEY'));

    await waitFor(() => expect(result.current.chat.isStreaming).toBe(false));
    expect(result.current.chat.messages).toMatchObject([
      { role: 'user', content: 'Who owns payments?' },
      { role: 'error', errorCode: 'INVALID_KEY', content: ASK_ERROR_MESSAGES.INVALID_KEY },
    ]);
    expect(result.current.connection.status).toBe('connected');
  });

  it('never sends an error back and retries the failed question', async () => {
    const requests = installFakeFetch();
    const { result } = renderHook(() => useAgentChat());

    act(() => result.current.send('Who owns payments?'));
    await act(async () => requests[0].respondWithError(429, 'RATE_LIMITED'));
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    const errorMessage = result.current.messages.find((message) => message.role === 'error');

    act(() => result.current.retry(errorMessage!.id));

    expect(requests[1].messages).toEqual([{ role: 'user', content: 'Who owns payments?' }]);
    expect(result.current.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  });

  it('stores token usage on each reply and relays map actions', async () => {
    const requests = installFakeFetch();
    const onAction = vi.fn();
    const { result } = renderHook(() => useAgentChat({ onAction }));

    for (const [index, inputTokens] of [1000, 2000].entries()) {
      act(() => result.current.send(`Question ${index}`));
      await act(async () => requests[index].respond());
      await act(async () => {
        requests[index].push({ type: 'action', kind: 'showHealth' });
        requests[index].push({ type: 'token', text: `Answer ${index}` });
        requests[index].push({ type: 'usage', inputTokens, outputTokens: 240 });
        requests[index].push({ type: 'done' });
        requests[index].finish();
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));
    }

    expect(replies(result.current.messages).map((reply) => reply.usage)).toEqual([
      { inputTokens: 1000, outputTokens: 240 },
      { inputTokens: 2000, outputTokens: 240 },
    ]);
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenCalledWith({ type: 'action', kind: 'showHealth' });
    expect(requests[1].messages).toEqual([
      { role: 'user', content: 'Question 0' },
      { role: 'assistant', content: 'Answer 0' },
      { role: 'user', content: 'Question 1' },
    ]);
  });
});
