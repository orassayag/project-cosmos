// Mirrors server/src/schemas/askRequestSchema.ts; the server rejects (never trims) anything past these.
export const CHAT_MAX_MESSAGES = 20;
export const CHAT_TOTAL_MAX_CHARS = 8000;
export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * Builds the `/api/ai/ask` messages from the chat so far plus the new question: the newest
 * turns that still alternate, start with the user, and fit both caps. Walking back from the
 * question and stopping at the first turn that breaks a rule is the same as dropping from the front.
 */
export function toRequestMessages(history: readonly ChatMessage[], question: string): ChatMessage[] {
  const trimmedQuestion = question.trim();
  const request: ChatMessage[] = [{ role: 'user', content: trimmedQuestion }];
  let totalCharacters = trimmedQuestion.length;
  for (let index = history.length - 1; index >= 0 && request.length < CHAT_MAX_MESSAGES; index -= 1) {
    const content = history[index].content.trim();
    const expectedRole: ChatRole = request[0].role === 'user' ? 'assistant' : 'user';
    const fits =
      history[index].role === expectedRole &&
      content.length > 0 &&
      content.length <= CHAT_MESSAGE_MAX_LENGTH &&
      totalCharacters + content.length <= CHAT_TOTAL_MAX_CHARS;
    if (!fits) break;
    request.unshift({ role: expectedRole, content });
    totalCharacters += content.length;
  }
  while (request[0].role !== 'user') request.shift();
  return request;
}
