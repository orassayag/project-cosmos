import { useCallback, useEffect, useRef, useState } from 'react';
import { toRequestMessages, type ChatMessage } from '../api/chatHistory';
import type { AskAction } from '../components/AskPanel';
import { streamAskMessages, toAskErrorMessage, type AskStreamEvent } from '../components/askStream';

export const STOPPED_REPLY_NOTE = '(reply stopped by the visitor)';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type AgentReplyStatus = 'streaming' | 'done' | 'stopped' | 'failed';

export interface AgentUserMessage {
  id: string;
  role: 'user';
  content: string;
}

export interface AgentReplyMessage {
  id: string;
  role: 'assistant';
  content: string;
  status: AgentReplyStatus;
  usage: TokenUsage | null;
}

export interface AgentErrorMessage {
  id: string;
  role: 'error';
  errorCode: string;
  content: string;
  /** The question that failed; `retry` asks it again. */
  question: string;
}

export type AgentChatMessage = AgentUserMessage | AgentReplyMessage | AgentErrorMessage;

export interface AgentChat {
  messages: AgentChatMessage[];
  isStreaming: boolean;
  send: (question: string) => void;
  stop: () => void;
  newChat: () => void;
  retry: (errorMessageId: string) => void;
}

export interface UseAgentChatOptions {
  onAction?: (action: AskAction) => void;
}

interface InFlightRequest {
  requestId: number;
  replyId: string;
  controller: AbortController;
}

/** Error messages and failed replies never go back to the server; a stopped reply carries the note so it is never empty. */
export function toChatHistory(messages: readonly AgentChatMessage[]): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (const message of messages) {
    if (message.role === 'user') {
      history.push({ role: 'user', content: message.content });
    } else if (message.role === 'assistant' && (message.status === 'done' || message.status === 'stopped')) {
      const partial = message.content.trim();
      const content =
        message.status === 'done' ? partial : partial === '' ? STOPPED_REPLY_NOTE : `${partial}\n\n${STOPPED_REPLY_NOTE}`;
      history.push({ role: 'assistant', content });
    }
  }
  return history;
}

/** Owned by App so the in-flight reply outlives the chat window; the window only renders this state. */
export function useAgentChat({ onAction }: UseAgentChatOptions = {}): AgentChat {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef<AgentChatMessage[]>([]);
  const inFlightRef = useRef<InFlightRequest | null>(null);
  const lastRequestIdRef = useRef(0);
  const lastMessageIdRef = useRef(0);
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  });

  const updateMessages = useCallback((update: (previous: AgentChatMessage[]) => AgentChatMessage[]) => {
    messagesRef.current = update(messagesRef.current);
    setMessages(messagesRef.current);
  }, []);

  const nextMessageId = useCallback(() => {
    lastMessageIdRef.current += 1;
    return `chat-${lastMessageIdRef.current}`;
  }, []);

  const updateReply = useCallback(
    (replyId: string, update: (reply: AgentReplyMessage) => AgentReplyMessage) => {
      updateMessages((previous) =>
        previous.map((message) => (message.id === replyId && message.role === 'assistant' ? update(message) : message)),
      );
    },
    [updateMessages],
  );

  const finishRequest = useCallback(() => {
    inFlightRef.current = null;
    setIsStreaming(false);
  }, []);

  const stop = useCallback(() => {
    const inFlight = inFlightRef.current;
    if (!inFlight) return;
    inFlight.controller.abort();
    updateReply(inFlight.replyId, (reply) => (reply.status === 'streaming' ? { ...reply, status: 'stopped' } : reply));
    finishRequest();
  }, [finishRequest, updateReply]);

  const send = useCallback(
    (question: string) => {
      const trimmedQuestion = question.trim();
      if (trimmedQuestion === '') return;
      stop();
      const requestMessages = toRequestMessages(toChatHistory(messagesRef.current), trimmedQuestion);
      lastRequestIdRef.current += 1;
      const requestId = lastRequestIdRef.current;
      const replyId = nextMessageId();
      const controller = new AbortController();
      inFlightRef.current = { requestId, replyId, controller };
      updateMessages((previous) => [
        ...previous,
        { id: nextMessageId(), role: 'user', content: trimmedQuestion },
        { id: replyId, role: 'assistant', content: '', status: 'streaming', usage: null },
      ]);
      setIsStreaming(true);

      const handleEvent = (event: AskStreamEvent) => {
        if (inFlightRef.current?.requestId !== requestId) return;
        switch (event.type) {
          case 'token':
            updateReply(replyId, (reply) => ({ ...reply, content: reply.content + event.text }));
            break;
          case 'action':
            onActionRef.current?.(event);
            break;
          case 'usage':
            updateReply(replyId, (reply) => ({
              ...reply,
              usage: { inputTokens: event.inputTokens, outputTokens: event.outputTokens },
            }));
            break;
          case 'error':
            updateMessages((previous) => [
              ...previous
                .filter((message) => !(message.id === replyId && message.content === ''))
                .map((message) =>
                  message.id === replyId && message.role === 'assistant' ? { ...message, status: 'failed' as const } : message,
                ),
              {
                id: nextMessageId(),
                role: 'error',
                errorCode: event.errorCode,
                content: toAskErrorMessage(event.errorCode),
                question: trimmedQuestion,
              },
            ]);
            break;
          case 'done':
            updateReply(replyId, (reply) => (reply.status === 'streaming' ? { ...reply, status: 'done' } : reply));
            finishRequest();
            break;
        }
      };
      void streamAskMessages(requestMessages, controller.signal, handleEvent);
    },
    [finishRequest, nextMessageId, stop, updateMessages, updateReply],
  );

  const newChat = useCallback(() => {
    stop();
    updateMessages(() => []);
  }, [stop, updateMessages]);

  const retry = useCallback(
    (errorMessageId: string) => {
      const errorIndex = messagesRef.current.findIndex((message) => message.id === errorMessageId);
      const errorMessage = messagesRef.current[errorIndex];
      if (!errorMessage || errorMessage.role !== 'error') return;
      let removeFrom = errorIndex;
      while (removeFrom > 0 && messagesRef.current[removeFrom].role !== 'user') removeFrom -= 1;
      stop();
      updateMessages((previous) => previous.filter((_message, index) => index < removeFrom || index > errorIndex));
      send(errorMessage.question);
    },
    [send, stop, updateMessages],
  );

  useEffect(() => () => inFlightRef.current?.controller.abort(), []);

  return { messages, isStreaming, send, stop, newChat, retry };
}
