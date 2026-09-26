import { OFF_TOPIC_ANSWERS } from './offTopicAnswers.js';
import type { CosmosMapSnapshot } from './types/cosmosMapSnapshot.js';

export const INTENTS = ['explainFlow', 'findService', 'playScenario', 'incident', 'ownership'] as const;
export type Intent = (typeof INTENTS)[number];

export const OFF_TOPIC_THRESHOLD = 0.35;
export const DIRECT_ACTION_THRESHOLD = 0.6;

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

export type PickIndex = (length: number) => number;

const randomIndex: PickIndex = (length) => Math.floor(Math.random() * length);

type PlayableSnapshot = Pick<CosmosMapSnapshot, 'scenarios' | 'incidents'>;

// Incidents are playable too, so they count as scenario targets alongside regular scenarios.
function findPlayable(snapshot: PlayableSnapshot, scenarioId: string | null) {
  if (scenarioId === null) return undefined;
  return [...snapshot.scenarios, ...snapshot.incidents].find((entry) => entry.id === scenarioId);
}

function offTopic(pickIndex: PickIndex): RouteDecision {
  const index = Math.min(Math.max(pickIndex(OFF_TOPIC_ANSWERS.length), 0), OFF_TOPIC_ANSWERS.length - 1);
  return { kind: 'offTopic', answer: OFF_TOPIC_ANSWERS[index] };
}

/** Decides how to answer a question without calling the visitor's model for off-topic or direct-action cases. */
export function decideRoute(
  input: RouteInput,
  snapshot: PlayableSnapshot,
  pickIndex: PickIndex = randomIndex,
): RouteDecision {
  if (input.source === 'localRelevance') {
    return input.onTopic
      ? { kind: 'agent', hints: { intent: null, targetScenarioId: null } }
      : offTopic(pickIndex);
  }

  const { onTopicProbability, intent, targetScenarioId, targetScenarioProbability } = input.classification;
  if (onTopicProbability < OFF_TOPIC_THRESHOLD) {
    return offTopic(pickIndex);
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
