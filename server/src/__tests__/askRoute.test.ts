import { randomBytes } from 'node:crypto';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createChatModel } from '../agent/chatModelFactory.js';
import { classifyQuestion } from '../agent/classify.js';
import { streamAgentAnswer, type AgentStreamEvent } from '../agent/graph.js';
import { ProviderError } from '../agent/providerErrors.js';
import app from '../app.js';
import { encryptCookiePayload } from '../cookieCrypto.js';
import cosmosMap from '../generated/cosmos-map.json' with { type: 'json' };

vi.mock('../agent/classify.js', () => ({ classifyQuestion: vi.fn() }));
vi.mock('../agent/chatModelFactory.js', () => ({ createChatModel: vi.fn() }));
vi.mock('../agent/graph.js', () => ({ streamAgentAnswer: vi.fn() }));

const API_KEY = 'sk-ant-secret-test-key';
const FAKE_MODEL = { fake: 'model' } as unknown as BaseChatModel;
const classifyQuestionMock = vi.mocked(classifyQuestion);
const createChatModelMock = vi.mocked(createChatModel);
const streamAgentAnswerMock = vi.mocked(streamAgentAnswer);

function ask(body: unknown, cookieValue?: string, signal?: AbortSignal): Promise<Response> {
  return Promise.resolve(
    app.request('/api/ai/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieValue ? { Cookie: `cosmos_ai=${cookieValue}` } : {}),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      signal,
    }),
  );
}

async function readEvents(response: Response): Promise<Record<string, unknown>[]> {
  const text = await response.text();
  expect(text.endsWith('\n')).toBe(true);
  return text
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function agentEvents(events: AgentStreamEvent[], failure?: Error): typeof streamAgentAnswer {
  return async function* () {
    yield* events;
    if (failure) throw failure;
  };
}

describe('POST /api/ai/ask', () => {
  let validCookie: string;
  let consoleLines: Mock;

  beforeEach(() => {
    const secret = randomBytes(32);
    vi.stubEnv('AI_COOKIE_SECRET', secret.toString('base64'));
    validCookie = encryptCookiePayload({ provider: 'anthropic', apiKey: API_KEY }, secret);
    classifyQuestionMock.mockResolvedValue({ source: 'localRelevance', onTopic: true });
    createChatModelMock.mockReturnValue(FAKE_MODEL);
    consoleLines = vi.fn();
    for (const level of ['log', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation(consoleLines);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('answers 401 NOT_CONNECTED without a cookie and never classifies', async () => {
    const response = await ask({ question: 'How does checkout work?' });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ errorCode: 'NOT_CONNECTED' });
    expect(classifyQuestionMock).not.toHaveBeenCalled();
  });

  it('treats a tampered cookie as not connected and clears it', async () => {
    const flippedCharacter = validCookie[20] === 'A' ? 'B' : 'A';
    const tamperedCookie = `${validCookie.slice(0, 20)}${flippedCharacter}${validCookie.slice(21)}`;

    const response = await ask({ question: 'How does checkout work?' }, tamperedCookie);

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(classifyQuestionMock).not.toHaveBeenCalled();
  });

  it('rejects a bad body with a named validation error', async () => {
    const response = await ask({ question: '   ' }, validCookie);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'INVALID_REQUEST', field: 'question' });
    expect(classifyQuestionMock).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    const response = await ask('not json', validCookie);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'INVALID_REQUEST', field: 'body' });
  });

  it('streams an off-topic reply with no usage and never builds the visitor model', async () => {
    classifyQuestionMock.mockResolvedValue({ source: 'localRelevance', onTopic: false });

    const response = await ask({ question: "What's the weather?" }, validCookie);
    const events = await readEvents(response);

    expect(response.headers.get('content-type')).toBe('application/x-ndjson');
    expect(events.map((event) => event.type)).toEqual(['token', 'done']);
    expect(events[0].text).toEqual(expect.any(String));
    expect(createChatModelMock).not.toHaveBeenCalled();
    expect(streamAgentAnswerMock).not.toHaveBeenCalled();
  });

  it('streams a direct action as token, playScenario action, done', async () => {
    const [scenario] = cosmosMap.scenarios;
    classifyQuestionMock.mockResolvedValue({
      source: 'classifier',
      classification: {
        onTopicProbability: 0.95,
        intent: 'playScenario',
        targetScenarioId: scenario.id,
        targetScenarioProbability: 0.9,
      },
    });

    const events = await readEvents(await ask({ question: `Play ${scenario.title}` }, validCookie));

    expect(events).toEqual([
      { type: 'token', text: `Playing *${scenario.title}* for you ▶` },
      { type: 'action', kind: 'playScenario', scenarioId: scenario.id },
      { type: 'done' },
    ]);
    expect(createChatModelMock).not.toHaveBeenCalled();
  });

  it('relays agent events in order, then done', async () => {
    const relayed: AgentStreamEvent[] = [
      { type: 'token', text: 'Checkout starts at' },
      { type: 'action', kind: 'highlight', serviceIds: ['checkout'] },
      { type: 'token', text: ' the gateway.' },
      { type: 'usage', inputTokens: 1180, outputTokens: 142 },
    ];
    streamAgentAnswerMock.mockImplementation(agentEvents(relayed));

    const events = await readEvents(await ask({ question: 'How does checkout work?' }, validCookie));

    expect(events).toEqual([...relayed, { type: 'done' }]);
    expect(createChatModelMock).toHaveBeenCalledWith({ provider: 'anthropic', apiKey: API_KEY });
    expect(streamAgentAnswerMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: FAKE_MODEL, question: 'How does checkout work?', snapshot: cosmosMap }),
    );
  });

  it('turns a ProviderError into an error line, then done, and logs only safe fields', async () => {
    streamAgentAnswerMock.mockImplementation(
      agentEvents(
        [{ type: 'token', text: 'Checkout' }],
        new ProviderError(`credit balance is too low for ${API_KEY}`, { errorCode: 'OUT_OF_CREDIT' }),
      ),
    );

    const events = await readEvents(await ask({ question: 'How does checkout work?' }, validCookie));

    expect(events).toEqual([
      { type: 'token', text: 'Checkout' },
      { type: 'error', errorCode: 'OUT_OF_CREDIT' },
      { type: 'done' },
    ]);
    const logLines = consoleLines.mock.calls.map(([line]) => JSON.parse(line as string) as Record<string, unknown>);
    expect(logLines).toContainEqual(
      expect.objectContaining({ errorCode: 'OUT_OF_CREDIT', provider: 'anthropic', noPHI: true }),
    );
    expect(JSON.stringify(consoleLines.mock.calls)).not.toContain(API_KEY);
  });

  it('does not report an aborted request as a provider failure', async () => {
    const abortController = new AbortController();
    streamAgentAnswerMock.mockImplementation(async function* () {
      yield { type: 'token', text: 'Checkout' };
      abortController.abort();
      throw new ProviderError('aborted', { errorCode: 'PROVIDER_ERROR' });
    });

    const response = await ask({ question: 'How does checkout work?' }, validCookie, abortController.signal);
    const events = await readEvents(response);

    expect(events).toEqual([{ type: 'token', text: 'Checkout' }]);
    expect(consoleLines).not.toHaveBeenCalled();
  });
});
