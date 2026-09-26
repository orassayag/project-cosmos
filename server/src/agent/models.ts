import type { AiProvider } from '../logger.js';

export const CLAUDE_DEFAULT_MODEL_ID = 'claude-sonnet-5';
// Pinned from developers.openai.com/api/docs/models (2026-09-26): the balanced tier, priced like Claude Sonnet 5.
export const OPENAI_DEFAULT_MODEL_ID = 'gpt-6-sol';

export const DEFAULT_MODEL_IDS = {
  anthropic: CLAUDE_DEFAULT_MODEL_ID,
  openai: OPENAI_DEFAULT_MODEL_ID,
} as const satisfies Record<AiProvider, string>;
