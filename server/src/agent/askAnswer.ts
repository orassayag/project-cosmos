import type { AiCookiePayload } from '../cookieCrypto.js';
import type { CosmosView } from '../cosmos/types.js';
import { createLogger } from '../logger.js';
import { createChatModel } from './chatModelFactory.js';
import { classifyQuestion } from './classify.js';
import { streamAgentAnswer, type AgentStreamEvent } from './graph.js';
import { getMapSnapshot } from './mapSnapshot.js';
import { toProviderError } from './providerErrors.js';
import { decideRoute } from './route.js';

export type ErrorEvent = { type: 'error'; errorCode: string };
export type DoneEvent = { type: 'done' };
export type AskStreamEvent = AgentStreamEvent | ErrorEvent | DoneEvent;

export interface AskAnswerInput {
  question: string;
  payload: AiCookiePayload;
  view: CosmosView;
  signal: AbortSignal;
}

const logger = createLogger('ask');

/**
 * Yields the §7 NDJSON events for one question. Every answer that isn't aborted ends
 * with `done`, including after an `error` event, so the client has one terminal signal.
 * An aborted request yields nothing further and is not logged: the visitor left.
 */
export async function* answerQuestion({ question, payload, view, signal }: AskAnswerInput): AsyncGenerator<AskStreamEvent> {
  const snapshot = getMapSnapshot(view);
  try {
    const decision = decideRoute(await classifyQuestion(question, snapshot, payload.gatewayApiKey), snapshot);
    if (decision.kind === 'offTopic') {
      yield { type: 'token', text: decision.answer };
    } else if (decision.kind === 'directAction') {
      yield { type: 'token', text: decision.answer };
      yield { type: 'action', kind: 'playScenario', scenarioId: decision.action.scenarioId };
    } else {
      const model = createChatModel(payload);
      yield* streamAgentAnswer({ model, view, hints: decision.hints, question, signal });
    }
  } catch (error) {
    if (signal.aborted) return;
    const { errorCode } = toProviderError(error);
    const logFields = { errorCode, provider: payload.provider };
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
