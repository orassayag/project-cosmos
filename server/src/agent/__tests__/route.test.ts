import { describe, expect, it } from 'vitest';
import cosmosMap from '../../generated/cosmos-map.json' with { type: 'json' };
import { OFF_TOPIC_ANSWERS } from '../offTopicAnswers.js';
import { decideRoute, type Classification, type RouteDecision } from '../route.js';

const PLACE_ORDER_ID = 'shopping.place-order';
const PLACE_ORDER_TITLE = 'Place an order';
const INCIDENT_ID = 'payment-cascade-2026-03-12';

const pickFirst = () => 0;

function classify(overrides: Partial<Classification>): Classification {
  return {
    onTopicProbability: 0.9,
    intent: 'playScenario',
    targetScenarioId: PLACE_ORDER_ID,
    targetScenarioProbability: 0.9,
    ...overrides,
  };
}

const OFF_TOPIC: RouteDecision = { kind: 'offTopic', answer: OFF_TOPIC_ANSWERS[0] };
const PLAY_PLACE_ORDER: RouteDecision = {
  kind: 'directAction',
  answer: `Playing *${PLACE_ORDER_TITLE}* for you ▶`,
  action: { type: 'playScenario', scenarioId: PLACE_ORDER_ID },
};

const CASES: { name: string; classification: Classification; expected: RouteDecision }[] = [
  { name: 'onTopic 0.34 is off-topic', classification: classify({ onTopicProbability: 0.34 }), expected: OFF_TOPIC },
  { name: 'onTopic 0 is off-topic', classification: classify({ onTopicProbability: 0 }), expected: OFF_TOPIC },
  { name: 'onTopic 0.35 is not off-topic', classification: classify({ onTopicProbability: 0.35 }), expected: PLAY_PLACE_ORDER },
  { name: 'target probability 0.6 plays directly', classification: classify({ targetScenarioProbability: 0.6 }), expected: PLAY_PLACE_ORDER },
  {
    name: 'target probability 0.59 goes to the agent',
    classification: classify({ targetScenarioProbability: 0.59 }),
    expected: { kind: 'agent', hints: { intent: 'playScenario', targetScenarioId: PLACE_ORDER_ID } },
  },
  {
    name: 'playScenario with no target goes to the agent',
    classification: classify({ targetScenarioId: null }),
    expected: { kind: 'agent', hints: { intent: 'playScenario', targetScenarioId: null } },
  },
  {
    name: 'confident target with another intent goes to the agent with hints',
    classification: classify({ intent: 'explainFlow' }),
    expected: { kind: 'agent', hints: { intent: 'explainFlow', targetScenarioId: PLACE_ORDER_ID } },
  },
  {
    name: 'unknown scenario id is dropped and goes to the agent',
    classification: classify({ targetScenarioId: 'shopping.teleport' }),
    expected: { kind: 'agent', hints: { intent: 'playScenario', targetScenarioId: null } },
  },
  {
    name: 'incidents are playable targets',
    classification: classify({ targetScenarioId: INCIDENT_ID }),
    expected: {
      kind: 'directAction',
      answer: 'Playing *Payment cascade* for you ▶',
      action: { type: 'playScenario', scenarioId: INCIDENT_ID },
    },
  },
];

describe('decideRoute — classifier results', () => {
  it.each(CASES)('$name', ({ classification, expected }) => {
    expect(decideRoute({ source: 'classifier', classification }, cosmosMap, pickFirst)).toEqual(expected);
  });

  it('picks the off-topic line with the injected index', () => {
    const decision = decideRoute(
      { source: 'classifier', classification: classify({ onTopicProbability: 0.1 }) },
      cosmosMap,
      () => 2,
    );
    expect(decision).toEqual({ kind: 'offTopic', answer: OFF_TOPIC_ANSWERS[2] });
  });

  it('only ever returns lines from OFF_TOPIC_ANSWERS with the default random pick', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const decision = decideRoute({ source: 'localRelevance', onTopic: false }, cosmosMap);
      expect(decision.kind).toBe('offTopic');
      if (decision.kind === 'offTopic') expect(OFF_TOPIC_ANSWERS).toContain(decision.answer);
    }
  });
});

describe('decideRoute — localRelevance fallback', () => {
  it('routes an off-topic fallback to a funny reply', () => {
    expect(decideRoute({ source: 'localRelevance', onTopic: false }, cosmosMap, pickFirst)).toEqual(OFF_TOPIC);
  });

  it('routes an on-topic fallback to the agent without hints, never a direct action', () => {
    expect(decideRoute({ source: 'localRelevance', onTopic: true }, cosmosMap, pickFirst)).toEqual({
      kind: 'agent',
      hints: { intent: null, targetScenarioId: null },
    });
  });
});
