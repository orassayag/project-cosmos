import type { CosmosMapSnapshot } from './mapSnapshot.js';

export const INTENTS = ['explainFlow', 'findService', 'playScenario', 'incident', 'ownership'] as const;
export type Intent = (typeof INTENTS)[number];

export const OFF_TOPIC_THRESHOLD = 0.35;
export const DIRECT_ACTION_THRESHOLD = 0.6;

export const OFF_TOPIC_ANSWER = 'I can only help with the AstroMart map — try asking about a service, a flow, or a team.';

/** Classifier output, already mapped out of the evaluator's shape. `targetScenarioId` is null for the "none" choice. */
export interface Classification {
  onTopicProbability: number;
  intent: Intent;
  targetScenarioId: string | null;
  targetScenarioProbability: number;
}

export type RouteInput =
  | { source: 'classifier'; classification: Classification }
  | { source: 'localRelevance'; onTopic: boolean };

export interface AgentHints {
  intent: Intent | null;
  targetScenarioId: string | null;
}

export type RouteDecision =
  | { kind: 'offTopic'; answer: string }
  | { kind: 'directAction'; answer: string; action: { type: 'playScenario'; scenarioId: string } }
  | { kind: 'agent'; hints: AgentHints };

type PlayableSnapshot = Pick<CosmosMapSnapshot, 'scenarios' | 'incidents'>;

// Incidents are playable too, so they count as scenario targets alongside regular scenarios.
function findPlayable(snapshot: PlayableSnapshot, scenarioId: string | null) {
  if (scenarioId === null) return undefined;
  return [...snapshot.scenarios, ...snapshot.incidents].find((entry) => entry.id === scenarioId);
}

const OFF_TOPIC: RouteDecision = { kind: 'offTopic', answer: OFF_TOPIC_ANSWER };

/** Decides how to answer a question without calling the configured model for off-topic or direct-action cases. */
export function decideRoute(input: RouteInput, snapshot: PlayableSnapshot): RouteDecision {
  if (input.source === 'localRelevance') {
    return input.onTopic
      ? { kind: 'agent', hints: { intent: null, targetScenarioId: null } }
      : OFF_TOPIC;
  }

  const { onTopicProbability, intent, targetScenarioId, targetScenarioProbability } = input.classification;
  if (onTopicProbability < OFF_TOPIC_THRESHOLD) {
    return OFF_TOPIC;
  }

  // An id the snapshot doesn't know (a stale or invented choice) is dropped rather than played.
  const target = findPlayable(snapshot, targetScenarioId);

  if (intent === 'playScenario' && target && targetScenarioProbability >= DIRECT_ACTION_THRESHOLD) {
    return {
      kind: 'directAction',
      answer: `Playing *${target.title}* for you ▶`,
      action: { type: 'playScenario', scenarioId: target.id },
    };
  }

  return { kind: 'agent', hints: { intent, targetScenarioId: target ? target.id : null } };
}
