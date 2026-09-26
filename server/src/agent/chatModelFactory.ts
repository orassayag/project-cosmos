import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import type { AiCookiePayload } from '../cookieCrypto.js';
import { DEFAULT_MODEL_IDS } from './models.js';

// Answers are capped at ~150 words by the system prompt; the visitor's key pays for every token.
export const MAX_OUTPUT_TOKENS = 1024;
// LangChain retries 429s by default, which would only repeat an out-of-quota failure on the visitor's key.
export const MODEL_MAX_RETRIES = 1;

export function createChatModel({ provider, apiKey }: AiCookiePayload): BaseChatModel {
  if (provider === 'anthropic') {
    return new ChatAnthropic({
      model: DEFAULT_MODEL_IDS.anthropic,
      apiKey,
      maxTokens: MAX_OUTPUT_TOKENS,
      maxRetries: MODEL_MAX_RETRIES,
    });
  }
  return new ChatOpenAI({
    model: DEFAULT_MODEL_IDS.openai,
    apiKey,
    maxRetries: MODEL_MAX_RETRIES,
    streamUsage: true,
    // gpt-6-sol only calls tools on Chat Completions with reasoning off. @langchain/openai@1.5.13 recognises
    // only o* / gpt-5* as reasoning models, so its `reasoning` and `maxTokens` options would send nothing /
    // the rejected `max_tokens`; the raw request fields are passed through instead.
    modelKwargs: { reasoning_effort: 'none', max_completion_tokens: MAX_OUTPUT_TOKENS },
  });
}
