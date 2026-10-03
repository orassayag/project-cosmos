import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import type { ChatMessage } from '../../api/chatHistory';
import { COSMOS_FIXTURE, renderWithCosmos } from '../../__tests__/renderWithCosmos';
import { useAgentChat, type AgentChatMessage } from '../../hooks/useAgentChat';
import { AgentChat, STARTER_QUESTIONS } from '../AgentChat';

const SERVICE = COSMOS_FIXTURE.data.services[0];

function renderChat(messages: AgentChatMessage[], { isStreaming = false } = {}) {
  const handlers = {
    onSend: vi.fn(),
    onStop: vi.fn(),
    onNewChat: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
    onExpand: vi.fn(),
  };
  renderWithCosmos(<AgentChat messages={messages} isStreaming={isStreaming} view="open" {...handlers} />);
  return handlers;
}

const QUESTION: AgentChatMessage = { id: 'chat-1', role: 'user', content: 'Who owns checkout?' };

function reply(overrides: Partial<Extract<AgentChatMessage, { role: 'assistant' }>> = {}): AgentChatMessage {
  return { id: 'chat-2', role: 'assistant', content: '', status: 'streaming', usage: null, actions: [], ...overrides };
}

function typeDraft(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: text } });
}

describe('AgentChat', () => {
  it('starts with the starter chips and a close button; a chip sends its question', () => {
    const { onSend, onClose } = renderChat([]);

    fireEvent.click(screen.getByRole('button', { name: STARTER_QUESTIONS[0] }));
    fireEvent.click(screen.getByRole('button', { name: 'Close the chat' }));

    expect(onSend).toHaveBeenCalledWith(STARTER_QUESTIONS[0]);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'New chat' })).toBeNull();
  });

  it('renders the history and the reply streaming in', () => {
    renderChat([QUESTION, reply({ content: 'The *payments* team.' })], { isStreaming: true });

    expect(screen.getByText('Who owns checkout?')).toBeTruthy();
    expect(screen.getByText('payments').tagName).toBe('EM');
    expect(screen.queryByLabelText('The agent is thinking')).toBeNull();
  });

  it('shows the thinking dots only before the first chunk', () => {
    renderChat([QUESTION, reply()], { isStreaming: true });

    expect(screen.getByRole('status', { name: 'The agent is thinking' }).querySelectorAll('.lc-chat-dot')).toHaveLength(3);
  });

  it('shows the counter only past 400 characters and disables Send at 500', () => {
    renderChat([]);
    const send = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Send' });

    typeDraft('a'.repeat(400));
    expect(document.querySelector('.lc-chat-counter')).toBeNull();
    expect(send().disabled).toBe(false);

    typeDraft('a'.repeat(412));
    expect(document.querySelector('.lc-chat-counter')?.textContent).toBe('412 / 500');
    expect(document.querySelector('.lc-chat-counter')?.getAttribute('data-at-limit')).toBe('false');

    typeDraft('a'.repeat(500));
    expect(document.querySelector('.lc-chat-counter')?.getAttribute('data-at-limit')).toBe('true');
    expect(send().disabled).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Your question' }).getAttribute('maxLength')).toBe('500');
  });

  it('sends the draft on Enter and clears it', () => {
    const { onSend } = renderChat([]);

    typeDraft('Who owns cart?');
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Your question' }), { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('Who owns cart?');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Your question' }).value).toBe('');
  });

  it('renders an error bubble with a retry, and the token count under a finished reply', () => {
    const { onRetry } = renderChat([
      QUESTION,
      reply({ content: 'Payments.', status: 'done', usage: { inputTokens: 1000, outputTokens: 240 } }),
      { id: 'chat-3', role: 'user', content: 'And cart?' },
      { id: 'chat-5', role: 'error', errorCode: 'INVALID_KEY', content: 'The AI provider refused the key.', question: 'And cart?' },
    ]);

    expect(screen.getByRole('alert').textContent).toContain('The AI provider refused the key.');
    expect(screen.getByText('≈ 1,240 tokens')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledWith('chat-5');
  });

  it('offers follow-up chips after a finished reply, and none while it streams', () => {
    const answered = reply({
      content: 'Here it is.',
      actions: [{ type: 'action', kind: 'highlight', serviceIds: [SERVICE.id] }],
    });
    const { onSend } = renderChat([QUESTION, { ...answered, status: 'done' } as AgentChatMessage]);

    fireEvent.click(screen.getByRole('button', { name: `Who owns ${SERVICE.name}?` }));
    expect(onSend).toHaveBeenCalledWith(`Who owns ${SERVICE.name}?`);
  });

  it('offers exactly a scripted reply\'s own follow-ups instead of suggesting chips', () => {
    renderChat([
      QUESTION,
      reply({
        content: 'Here it is.',
        status: 'done',
        actions: [{ type: 'action', kind: 'highlight', serviceIds: [SERVICE.id] }],
        followUps: ['Who owns shipping?'],
      }),
    ]);

    const chips = screen.getByRole('group', { name: 'Suggested follow-ups' }).querySelectorAll('button');
    expect([...chips].map((chip) => chip.textContent)).toEqual(['Who owns shipping?']);
    expect(chips[0].getAttribute('data-demo-target')).toBe('agent-followup-0');
  });

  it('shows no follow-up chips after a scripted reply that offers none', () => {
    renderChat([QUESTION, reply({ content: 'Done.', status: 'done', followUps: [] })]);

    expect(screen.queryByRole('group', { name: 'Suggested follow-ups' })).toBeNull();
  });

  it('folds into a tab with the latest line and the unread dot', () => {
    const onExpand = vi.fn();
    renderWithCosmos(
      <AgentChat
        messages={[QUESTION, reply({ content: 'First line\nLatest line', status: 'done' })]}
        isStreaming={false}
        view="collapsed"
        hasUnread
        onSend={vi.fn()}
        onStop={vi.fn()}
        onNewChat={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
        onExpand={onExpand}
      />,
    );

    const tab = screen.getByRole('button', { name: 'Reopen the agent chat' });
    expect(tab.textContent).toBe('Latest line');
    expect(screen.getByTestId('chat-unread-dot')).toBeTruthy();
    fireEvent.click(tab);
    expect(onExpand).toHaveBeenCalled();
  });
});

function installFakeAskServer() {
  const requests: Array<{ messages: ChatMessage[]; push: (event: object) => void; finish: () => void }> = [];
  const encoder = new TextEncoder();
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      let streamController!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({ start: (controller) => void (streamController = controller) });
      (init.signal as AbortSignal).addEventListener('abort', () => streamController.error(new DOMException('Aborted', 'AbortError')));
      requests.push({
        messages: (JSON.parse(init.body as string) as { messages: ChatMessage[] }).messages,
        push: (event) => streamController.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
        finish: () => streamController.close(),
      });
      return Promise.resolve(new Response(body));
    }),
  );
  return requests;
}

function LiveChat() {
  const chat = useAgentChat();
  return (
    <AgentChat
      messages={chat.messages}
      isStreaming={chat.isStreaming}
      view="open"
      onSend={chat.send}
      onStop={chat.stop}
      onNewChat={chat.newChat}
      onRetry={chat.retry}
      onClose={vi.fn()}
      onExpand={vi.fn()}
    />
  );
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe('AgentChat with useAgentChat', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function ask(question: string) {
    typeDraft(question);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await flush();
  }

  it('Stop re-enables the composer and marks the reply as stopped', async () => {
    const requests = installFakeAskServer();
    renderWithCosmos(<LiveChat />);

    await ask('Who owns payments?');
    act(() => requests[0].push({ type: 'token', text: 'The payments' }));
    await flush();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await flush();

    expect(screen.getByText('Reply stopped')).toBeTruthy();
    typeDraft('And cart?');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send' }).disabled).toBe(false);
  });

  it('after New chat the next request carries only the new question', async () => {
    const requests = installFakeAskServer();
    renderWithCosmos(<LiveChat />);

    await ask('Who owns payments?');
    act(() => {
      requests[0].push({ type: 'token', text: 'Payments team.' });
      requests[0].push({ type: 'done' });
      requests[0].finish();
    });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.getByRole('button', { name: STARTER_QUESTIONS[0] })).toBeTruthy();
    await ask('Who owns cart?');

    expect(requests[1].messages).toEqual([{ role: 'user', content: 'Who owns cart?' }]);
  });
});
