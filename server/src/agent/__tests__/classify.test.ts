import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import cosmosMap from '../../generated/cosmos-map.json' with { type: 'json' };
import { decideRoute } from '../route.js';

vi.mock('ai', () => ({ experimental_evaluate: vi.fn() }));

const OFF_TOPIC_QUESTION = "what's the weather";
const ON_TOPIC_QUESTION = 'what does payments-gateway do';

type ClassifyModule = typeof import('../classify.js');

describe('classifyQuestion', () => {
  let classifyModule: ClassifyModule;
  let evaluateStub: Mock;
  let consoleWarn: Mock;
  let visitorModel: Mock;

  function jevWarnings(): unknown[] {
    return consoleWarn.mock.calls
      .map(([line]) => JSON.parse(String(line)))
      .filter((entry) => entry.errorCode === 'JEV_UNAVAILABLE');
  }

  async function answer(question: string) {
    const decision = decideRoute(await classifyModule.classifyQuestion(question, cosmosMap), cosmosMap, () => 0);
    if (decision.kind === 'agent') {
      visitorModel(question);
    }
    return decision;
  }

  beforeEach(async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'gateway-test-key');
    consoleWarn = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(consoleWarn);
    visitorModel = vi.fn();
    // A fresh module graph resets classify's warn-once flag between cases.
    vi.resetModules();
    evaluateStub = vi.mocked((await import('ai')).experimental_evaluate) as unknown as Mock;
    evaluateStub.mockReset();
    classifyModule = await import('../classify.js');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('when JEV throws', () => {
    beforeEach(() => {
      evaluateStub.mockRejectedValue(new Error('gateway 502'));
    });

    it('falls back to localRelevance and never calls the visitor model for an off-topic question', async () => {
      const decision = await answer(OFF_TOPIC_QUESTION);

      expect(evaluateStub).toHaveBeenCalledTimes(1);
      expect(decision.kind).toBe('offTopic');
      expect(visitorModel).not.toHaveBeenCalled();
      expect(jevWarnings()).toHaveLength(1);
    });

    it('sends an on-topic question to the agent with no hints', async () => {
      const decision = await answer(ON_TOPIC_QUESTION);

      expect(decision).toEqual({ kind: 'agent', hints: { intent: null, targetScenarioId: null } });
    });
  });

  describe('when AI_GATEWAY_API_KEY is unset', () => {
    beforeEach(() => {
      vi.stubEnv('AI_GATEWAY_API_KEY', undefined);
    });

    it('never calls JEV, lets localRelevance decide, and warns once across two questions', async () => {
      const offTopicDecision = await answer(OFF_TOPIC_QUESTION);
      const onTopicDecision = await answer(ON_TOPIC_QUESTION);

      expect(evaluateStub).not.toHaveBeenCalled();
      expect(offTopicDecision.kind).toBe('offTopic');
      expect(onTopicDecision.kind).toBe('agent');
      expect(visitorModel).toHaveBeenCalledTimes(1);
      expect(jevWarnings()).toHaveLength(1);
    });
  });

  it('falls back to localRelevance when JEV takes longer than the timeout', async () => {
    vi.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    evaluateStub.mockImplementation(({ abortSignal }: { abortSignal: AbortSignal }) => {
      receivedSignal = abortSignal;
      return new Promise(() => {});
    });

    const pending = classifyModule.classifyQuestion(OFF_TOPIC_QUESTION, cosmosMap);
    await vi.advanceTimersByTimeAsync(classifyModule.JEV_TIMEOUT_MS);

    expect(await pending).toEqual({ source: 'localRelevance', onTopic: false });
    expect(receivedSignal?.aborted).toBe(true);
    expect(jevWarnings()).toHaveLength(1);
  });

  it('maps a JEV answer into a classifier RouteInput', async () => {
    evaluateStub.mockResolvedValue({
      answers: {
        onTopic: { type: 'boolean', probability: 0.92 },
        intent: { type: 'choice', choice: 'playScenario' },
        targetScenario: {
          type: 'choice',
          choice: 'shopping.place-order',
          probabilities: { none: 0.1, 'shopping.place-order': 0.9 },
        },
      },
    });

    const routeInput = await classifyModule.classifyQuestion('show me placing an order', cosmosMap);

    expect(routeInput).toEqual({
      source: 'classifier',
      classification: {
        onTopicProbability: 0.92,
        intent: 'playScenario',
        targetScenarioId: 'shopping.place-order',
        targetScenarioProbability: 0.9,
      },
    });
    const call = evaluateStub.mock.calls[0][0];
    expect(call.model).toBe('typesafe-ai/jev');
    expect(Object.keys(call.state).sort()).toEqual(['domainNames', 'question', 'serviceNames', 'topicNames']);
    expect(Object.keys(call.questions.targetScenario.criteria)).toHaveLength(
      1 + cosmosMap.scenarios.length + cosmosMap.incidents.length,
    );
    expect(call.providerOptions).toEqual({ gateway: { zeroDataRetention: true } });
    expect(jevWarnings()).toHaveLength(0);
  });

  it('maps the "none" target to null with zero probability when no distribution is given', async () => {
    evaluateStub.mockResolvedValue({
      answers: {
        onTopic: { type: 'boolean', probability: 0.8 },
        intent: { type: 'choice', choice: 'explainFlow' },
        targetScenario: { type: 'choice', choice: 'none' },
      },
    });

    const routeInput = await classifyModule.classifyQuestion('how does checkout work', cosmosMap);

    expect(routeInput).toEqual({
      source: 'classifier',
      classification: {
        onTopicProbability: 0.8,
        intent: 'explainFlow',
        targetScenarioId: null,
        targetScenarioProbability: 0,
      },
    });
  });
});
