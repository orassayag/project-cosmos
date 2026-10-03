import { describe, expect, it } from 'vitest';
import { getMapSnapshot } from '../mapSnapshot.js';
import { decideRoute, OFF_TOPIC_ANSWER, type Classification, type RouteDecision } from '../route.js';

const cosmosMap = getMapSnapshot();

const PLACE_ORDER_ID = 'shopping.place-order';
const PLACE_ORDER_TITLE = 'Place an order';
const INCIDENT_ID = 'payment-cascade-2026-03-12';

function classify(overrides: Partial<Classification>): Classification {
  return {
    onTopicProbability: 0.9,
    intent: 'playScenario',
    targetScenarioId: PLACE_ORDER_ID,
    targetScenarioProbability: 0.9,
    ...overrides,
  };
}

const OFF_TOPIC: RouteDecision = {
  kind: 'offTopic',
  answer: 'I can only help with the AstroMart map — try asking about a service, a flow, or a team.',
};
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
    expect(decideRoute({ source: 'classifier', classification }, cosmosMap)).toEqual(expected);
  });

  it('always gives the same fixed redirect for an off-topic question', () => {
    const decisions = [0, 0.1, 0.2, 0.34].map((onTopicProbability) =>
      decideRoute({ source: 'classifier', classification: classify({ onTopicProbability }) }, cosmosMap),
    );

    expect(new Set(decisions.map((decision) => (decision.kind === 'offTopic' ? decision.answer : null)))).toEqual(
      new Set([OFF_TOPIC_ANSWER]),
    );
  });
});

describe('decideRoute — localRelevance fallback', () => {
  it('routes an off-topic fallback to the fixed redirect', () => {
    expect(decideRoute({ source: 'localRelevance', onTopic: false }, cosmosMap)).toEqual(OFF_TOPIC);
  });

  it('routes an on-topic fallback to the agent without hints, never a direct action', () => {
    expect(decideRoute({ source: 'localRelevance', onTopic: true }, cosmosMap)).toEqual({
      kind: 'agent',
      hints: { intent: null, targetScenarioId: null },
    });
  });
});
