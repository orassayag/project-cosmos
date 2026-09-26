import { z } from 'zod';

// Keeps the classifier and agent inputs small; a real map question fits easily.
const QUESTION_MAX_LENGTH = 500;

export const AskRequestSchema = z.object({
  question: z
    .string({ error: 'question must be a string' })
    .trim()
    .min(1, { error: 'question must not be empty' })
    .max(QUESTION_MAX_LENGTH, { error: `question must be at most ${QUESTION_MAX_LENGTH} characters` }),
});

export type AskRequest = z.infer<typeof AskRequestSchema>;
