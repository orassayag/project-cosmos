import { describe, expect, it } from 'vitest';
import {
  CHAT_MAX_MESSAGES,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_TOTAL_MAX_CHARS,
  toRequestMessages,
  type ChatMessage,
} from '../chatHistory';

function alternatingHistory(length: number, contentOf: (index: number) => string): ChatMessage[] {
  return Array.from({ length }, (_, index) => ({ role: index % 2 === 0 ? 'user' : 'assistant', content: contentOf(index) }));
}

function expectValidRequest(request: ChatMessage[], question: string) {
  expect(request.length).toBeGreaterThanOrEqual(1);
  expect(request.length).toBeLessThanOrEqual(CHAT_MAX_MESSAGES);
  expect(request[0].role).toBe('user');
  request.forEach((message, index) => expect(message.role).toBe(index % 2 === 0 ? 'user' : 'assistant'));
  expect(request.reduce((sum, message) => sum + message.content.length, 0)).toBeLessThanOrEqual(CHAT_TOTAL_MAX_CHARS);
  expect(request.at(-1)).toEqual({ role: 'user', content: question });
}

describe('toRequestMessages', () => {
  it('sends just the question when there is no history', () => {
    expect(toRequestMessages([], '  how does checkout work?  ')).toEqual([
      { role: 'user', content: 'how does checkout work?' },
    ]);
  });

  it.each(Array.from({ length: 60 }, (_, index) => index + 1))(
    'builds a valid request from a %i-message history',
    (length) => {
      // Ends on an assistant turn, as a chat does once its last answer has finished.
      const history = alternatingHistory(length % 2 === 0 ? length : length + 1, (index) => `turn ${index}`);
      const request = toRequestMessages(history, 'next?');

      expectValidRequest(request, 'next?');
    },
  );

  it.each([10, 26, 60])('keeps the newest turns that fit the character cap (%i long turns)', (length) => {
    const history = alternatingHistory(length, (index) => `${index}:`.padEnd(CHAT_MESSAGE_MAX_LENGTH - 100, 'x'));
    const request = toRequestMessages(history, 'next?');

    expectValidRequest(request, 'next?');
    expect(request.at(-2)).toEqual(history.at(-1));
  });

  it('keeps the newest 19 turns plus the question', () => {
    const history = alternatingHistory(40, (index) => `turn ${index}`);
    const request = toRequestMessages(history, 'next?');

    expect(request).toHaveLength(CHAT_MAX_MESSAGES - 1);
    expect(request.slice(0, -1)).toEqual(history.slice(-(CHAT_MAX_MESSAGES - 2)));
  });

  it('stops at a turn that breaks alternation, such as an unanswered question', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' },
      { role: 'user', content: 'this one failed' },
    ];

    expect(toRequestMessages(history, 'retry')).toEqual([{ role: 'user', content: 'retry' }]);
  });

  it('stops at an empty or over-long turn', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'x'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1) },
      { role: 'user', content: 'second' },
      { role: 'assistant', content: '   ' },
    ];

    expect(toRequestMessages(history, 'third')).toEqual([{ role: 'user', content: 'third' }]);
  });
});
