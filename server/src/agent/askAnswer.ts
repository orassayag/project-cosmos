import type { AgentConfig } from '../agentConfig.js';
import type { CosmosView } from '../cosmos/types.js';
import { createLogger } from '../logger.js';
import type { ChatMessage } from '../schemas/askRequestSchema.js';
import { createChatModel } from './chatModelFactory.js';
import { classifyQuestion } from './classify.js';
import { streamAgentAnswer, type AgentStreamEvent } from './graph.js';
import { getMapSnapshot } from './mapSnapshot.js';
import { toProviderError } from './providerErrors.js';
import { decideRoute, type RouteDecision } from './route.js';

export type ErrorEvent = { type: 'error'; errorCode: string };
export type DoneEvent = { type: 'done' };
export type AskStreamEvent = AgentStreamEvent | ErrorEvent | DoneEvent;

export interface AskAnswerInput {
  /** Validated by AskRequestSchema: alternates user/assistant, starts and ends with the user. */
  messages: readonly ChatMessage[];
  config: AgentConfig;
  view: CosmosView;
  signal: AbortSignal;
}

const logger = createLogger('ask');

const FOLLOW_UP_DECISION: RouteDecision = { kind: 'agent', hints: { intent: null, targetScenarioId: null } };

/**
 * Yields the §7 NDJSON events for one chat turn. Only a chat's first message is classified;
 * a follow-up ("and who owns it?") would read as off-topic alone, so it goes straight to the agent.
 * Every answer that isn't aborted ends with `done`, including after an `error` event,
 * so the client has one terminal signal.
 * An aborted request yields nothing further and is not logged: the visitor left.
 */
export async function* answerQuestion({ messages, config, view, signal }: AskAnswerInput): AsyncGenerator<AskStreamEvent> {
  const snapshot = getMapSnapshot(view);
  try {
    const decision =
      messages.length === 1
        ? decideRoute(await classifyQuestion(messages[0].content, snapshot, config.gatewayApiKey), snapshot)
        : FOLLOW_UP_DECISION;
    if (decision.kind === 'offTopic') {
      yield { type: 'token', text: decision.answer };
    } else if (decision.kind === 'directAction') {
      yield { type: 'token', text: decision.answer };
      yield { type: 'action', kind: 'playScenario', scenarioId: decision.action.scenarioId };
    } else {
      const model = createChatModel(config);
      yield* streamAgentAnswer({ model, view, hints: decision.hints, messages, signal });
    }
  } catch (error) {
    if (signal.aborted) return;
    const { errorCode } = toProviderError(error);
    const logFields = { errorCode, provider: config.provider };
    if (errorCode === 'PROVIDER_ERROR') {
      logger.error('Agent answer failed', logFields);
    } else {
      logger.warn('Provider rejected the agent request', logFields);
    }
    yield { type: 'error', errorCode };
  }
  if (signal.aborted) return;
  yield { type: 'done' };
}
