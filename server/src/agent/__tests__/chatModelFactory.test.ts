import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { describe, expect, it } from 'vitest';
import { createChatModel, MAX_OUTPUT_TOKENS } from '../chatModelFactory.js';
import { DEFAULT_MODEL_IDS } from '../models.js';

describe('createChatModel', () => {
  it('builds ChatAnthropic with the default Claude model for an anthropic cookie', () => {
    const model = createChatModel({ provider: 'anthropic', apiKey: 'sk-ant-test' });

    expect(model).toBeInstanceOf(ChatAnthropic);
    expect(model).toMatchObject({ model: DEFAULT_MODEL_IDS.anthropic, maxTokens: MAX_OUTPUT_TOKENS });
  });

  it('builds ChatOpenAI that sends reasoning_effort none so gpt-6-sol can call tools', () => {
    const model = createChatModel({ provider: 'openai', apiKey: 'sk-test' });

    expect(model).toBeInstanceOf(ChatOpenAI);
    const requestParams = (model as ChatOpenAI).invocationParams();
    expect(requestParams).toMatchObject({
      model: DEFAULT_MODEL_IDS.openai,
      reasoning_effort: 'none',
      max_completion_tokens: MAX_OUTPUT_TOKENS,
    });
    // Serialised like the request body, where an undefined field is omitted.
    expect(JSON.parse(JSON.stringify(requestParams))).not.toHaveProperty('max_tokens');
  });
});
