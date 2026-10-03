import { z } from 'zod';

// The client trims history to these same limits (client/src/api/chatHistory.ts); keep both in step.
export const CHAT_MAX_MESSAGES = 20;
export const CHAT_TOTAL_MAX_CHARS = 8000;
export const CHAT_MESSAGE_MAX_LENGTH = 2000;
// Keeps the classifier and agent inputs small; a real map question fits easily.
export const QUESTION_MAX_LENGTH = 500;

export const ChatMessageSchema = z.strictObject({
  role: z.enum(['user', 'assistant'], { error: "role must be 'user' or 'assistant'" }),
  content: z
    .string({ error: 'content must be a string' })
    .trim()
    .min(1, { error: 'content must not be empty' })
    .max(CHAT_MESSAGE_MAX_LENGTH, { error: `content must be at most ${CHAT_MESSAGE_MAX_LENGTH} characters` }),
});

export const AskRequestSchema = z
  .strictObject({
    messages: z
      .array(ChatMessageSchema, { error: 'messages must be an array' })
      .min(1, { error: 'messages must hold at least one message' })
      .max(CHAT_MAX_MESSAGES, { error: `messages must hold at most ${CHAT_MAX_MESSAGES} messages` }),
  })
  .superRefine(({ messages }, context) => {
    if (messages.length === 0) return;
    if (messages[0].role !== 'user') {
      context.addIssue({ code: 'custom', path: ['messages', 0, 'role'], message: 'the first message must be from the user' });
      return;
    }
    const alternationBreak = messages.findIndex((message, index) => message.role !== (index % 2 === 0 ? 'user' : 'assistant'));
    if (alternationBreak !== -1) {
      context.addIssue({
        code: 'custom',
        path: ['messages', alternationBreak, 'role'],
        message: 'messages must alternate between user and assistant',
      });
      return;
    }
    const lastIndex = messages.length - 1;
    if (messages[lastIndex].role !== 'user') {
      context.addIssue({ code: 'custom', path: ['messages', lastIndex, 'role'], message: 'the last message must be from the user' });
      return;
    }
    if (messages[lastIndex].content.length > QUESTION_MAX_LENGTH) {
      context.addIssue({
        code: 'custom',
        path: ['messages', lastIndex, 'content'],
        message: `the question must be at most ${QUESTION_MAX_LENGTH} characters`,
      });
      return;
    }
    const totalCharacters = messages.reduce((sum, message) => sum + message.content.length, 0);
    if (totalCharacters > CHAT_TOTAL_MAX_CHARS) {
      context.addIssue({
        code: 'custom',
        path: ['messages'],
        message: `messages must total at most ${CHAT_TOTAL_MAX_CHARS} characters`,
      });
    }
  });

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type AskRequest = z.infer<typeof AskRequestSchema>;
