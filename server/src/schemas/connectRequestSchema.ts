import { z } from 'zod';
import { AI_PROVIDERS } from '../logger.js';

// Bounds the sealed cookie well under the 4 KB browser limit.
const API_KEY_MAX_LENGTH = 512;

export const ConnectRequestSchema = z.object({
  provider: z.enum(AI_PROVIDERS, {
    error: `provider must be one of: ${AI_PROVIDERS.join(', ')}`,
  }),
  apiKey: z
    .string({ error: 'apiKey must be a string' })
    .trim()
    .min(1, { error: 'apiKey must not be empty' })
    .max(API_KEY_MAX_LENGTH, { error: `apiKey must be at most ${API_KEY_MAX_LENGTH} characters` }),
  // The visitor's own Vercel AI Gateway key for the JEV question classifier; blank means "use the site's".
  gatewayApiKey: z
    .string({ error: 'gatewayApiKey must be a string' })
    .trim()
    .max(API_KEY_MAX_LENGTH, { error: `gatewayApiKey must be at most ${API_KEY_MAX_LENGTH} characters` })
    .optional()
    .transform((gatewayApiKey) => gatewayApiKey || undefined),
});

export type ConnectRequest = z.infer<typeof ConnectRequestSchema>;
