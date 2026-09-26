import { createGateway, experimental_evaluate as evaluate } from 'ai';
import { getGatewayApiKey } from '../config.js';
import { createLogger } from '../logger.js';
import { localRelevance } from './localRelevance.js';
import type { Classification, RouteInput } from './route.js';
import type { CosmosMapSnapshot } from './types/cosmosMapSnapshot.js';

export const JEV_MODEL_ID = 'typesafe-ai/jev';
export const JEV_TIMEOUT_MS = 3000;
export const JEV_UNAVAILABLE = 'JEV_UNAVAILABLE';

const NO_TARGET_SCENARIO = 'none';

const logger = createLogger('classify');
let hasWarnedMissingGatewayKey = false;

export class JevTimeoutError extends Error {
  readonly errorCode = JEV_UNAVAILABLE;

  constructor(timeoutMs: number) {
    super(`JEV evaluation did not finish within ${timeoutMs}ms`);
    this.name = 'JevTimeoutError';
  }
}

function buildScenarioCriteria(snapshot: CosmosMapSnapshot): Record<string, string> {
  const criteria: Record<string, string> = { [NO_TARGET_SCENARIO]: 'No specific scenario' };
  for (const playable of [...snapshot.scenarios, ...snapshot.incidents]) {
    criteria[playable.id] = playable.title;
  }
  return criteria;
}

function buildQuestions(snapshot: CosmosMapSnapshot) {
  return {
    onTopic: {
      type: 'boolean',
      instructions:
        'Is this question about the AstroMart system shown on the map — its services, topics, flows, teams, or incidents?',
      criteria: {
        true: 'About the map/architecture',
        false: 'Unrelated (weather, jokes, general trivia, other companies)',
      },
    },
    intent: {
      type: 'choice',
      instructions: 'What does the visitor want?',
      criteria: {
        explainFlow: 'How something works or what happens when X',
        findService: 'Which service/topic does or owns something',
        playScenario: 'Wants to see a flow play on the map',
        incident: 'About a past production incident',
        ownership: 'Which team owns something',
      },
    },
    targetScenario: {
      type: 'choice',
      instructions: 'Which scenario best matches the question, if any?',
      criteria: buildScenarioCriteria(snapshot),
    },
  } as const;
}

async function evaluateWithTimeout(question: string, snapshot: CosmosMapSnapshot, gatewayApiKey: string): Promise<Classification> {
  const abortController = new AbortController();
  let rejectOnTimeout: (error: JevTimeoutError) => void = () => {};
  const timeoutPromise = new Promise<never>((_, reject) => {
    rejectOnTimeout = reject;
  });
  const timer = setTimeout(() => {
    const timeoutError = new JevTimeoutError(JEV_TIMEOUT_MS);
    abortController.abort(timeoutError);
    rejectOnTimeout(timeoutError);
  }, JEV_TIMEOUT_MS);

  try {
    // The race guarantees the 3s budget even if the provider ignores the abort signal.
    const result = await Promise.race([
      evaluate({
        model: createGateway({ apiKey: gatewayApiKey }).evaluationModel(JEV_MODEL_ID),
        state: {
          question,
          serviceNames: snapshot.services.map((service) => service.name),
          topicNames: snapshot.topics.map((topic) => topic.name),
          domainNames: snapshot.domains.map((domain) => domain.label),
        },
        questions: buildQuestions(snapshot),
        abortSignal: abortController.signal,
        providerOptions: { gateway: { zeroDataRetention: true } },
      }),
      timeoutPromise,
    ]);

    const { onTopic, intent, targetScenario } = result.answers;
    const targetScenarioId = targetScenario.choice === NO_TARGET_SCENARIO ? null : targetScenario.choice;
    return {
      onTopicProbability: onTopic.probability,
      intent: intent.choice,
      targetScenarioId,
      // Without a distribution the target's confidence is unknown, so it must not unlock a direct action.
      targetScenarioProbability: targetScenario.probabilities?.[targetScenario.choice] ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

function fallBackToLocalRelevance(question: string, snapshot: CosmosMapSnapshot): RouteInput {
  return { source: 'localRelevance', onTopic: localRelevance(question, snapshot) };
}

/**
 * Classifies a question for `decideRoute`; never calls the visitor's model, and falls back to the free keyword check.
 * A gateway key the visitor supplied is billed instead of the site owner's.
 */
export async function classifyQuestion(
  question: string,
  snapshot: CosmosMapSnapshot,
  visitorGatewayApiKey?: string,
): Promise<RouteInput> {
  const gatewayApiKey = visitorGatewayApiKey ?? getGatewayApiKey();
  const keySource = visitorGatewayApiKey ? 'visitor' : 'site';
  if (!gatewayApiKey) {
    if (!hasWarnedMissingGatewayKey) {
      hasWarnedMissingGatewayKey = true;
      logger.warn('AI_GATEWAY_API_KEY is not set; classifying with localRelevance', { errorCode: JEV_UNAVAILABLE });
    }
    return fallBackToLocalRelevance(question, snapshot);
  }

  try {
    return { source: 'classifier', classification: await evaluateWithTimeout(question, snapshot, gatewayApiKey) };
  } catch (error) {
    // Logged per failure (not once) so gateway outages show up as a spike.
    const reason = error instanceof JevTimeoutError ? error.message : `JEV evaluation failed (${errorName(error)})`;
    logger.warn(`${reason} with the ${keySource} gateway key; classifying with localRelevance`, { errorCode: JEV_UNAVAILABLE });
    return fallBackToLocalRelevance(question, snapshot);
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
