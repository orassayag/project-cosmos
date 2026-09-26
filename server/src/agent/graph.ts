import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import { END, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { getMapDigest } from './context.js';
import { createMapActionTools, isMapActionEvent, type MapActionEvent } from './mapActionTools.js';
import { toProviderError } from './providerErrors.js';
import type { AgentHints } from './route.js';
import { buildSystemPrompt } from './systemPrompt.js';
import type { CosmosMapSnapshot } from './types/cosmosMapSnapshot.js';

export const AGENT_NODE = 'agent';
export const TOOLS_NODE = 'tools';
// Every super-step counts: agent + tools per round, so this allows three tool rounds and a final answer.
export const AGENT_RECURSION_LIMIT = 8;

export type TokenEvent = { type: 'token'; text: string };
export type UsageEvent = { type: 'usage'; inputTokens: number; outputTokens: number };
export type AgentStreamEvent = TokenEvent | MapActionEvent | UsageEvent;

export interface AgentGraphInput {
  model: BaseChatModel;
  snapshot: CosmosMapSnapshot;
  hints: AgentHints;
}

export interface AgentAnswerInput extends AgentGraphInput {
  question: string;
  signal?: AbortSignal;
}

export function buildAgentGraph({ model, snapshot, hints }: AgentGraphInput) {
  if (!model.bindTools) {
    throw new TypeError('The chat model does not support tool calling');
  }
  const tools = createMapActionTools(snapshot);
  const modelWithTools = model.bindTools(tools);
  const systemMessage = new SystemMessage(buildSystemPrompt({ digest: getMapDigest(snapshot), hints }));

  async function callModel(state: typeof MessagesAnnotation.State, config: RunnableConfig) {
    const response = await modelWithTools.invoke([systemMessage, ...state.messages], config);
    return { messages: [response] };
  }

  return new StateGraph(MessagesAnnotation)
    .addNode(AGENT_NODE, callModel)
    .addNode(TOOLS_NODE, new ToolNode(tools))
    .addEdge(START, AGENT_NODE)
    .addConditionalEdges(AGENT_NODE, toolsCondition, [TOOLS_NODE, END])
    .addEdge(TOOLS_NODE, AGENT_NODE)
    .compile();
}

function sumUsage(messages: readonly BaseMessage[], total: UsageEvent): void {
  for (const message of messages) {
    if (AIMessage.isInstance(message) && message.usage_metadata) {
      total.inputTokens += message.usage_metadata.input_tokens;
      total.outputTokens += message.usage_metadata.output_tokens;
    }
  }
}

/**
 * Runs the agent and yields token / action events in stream order, then one usage event.
 * Any failure is rethrown as a ProviderError so the caller can put its errorCode on the wire.
 */
export async function* streamAgentAnswer({
  question,
  signal,
  ...graphInput
}: AgentAnswerInput): AsyncGenerator<AgentStreamEvent> {
  const usage: UsageEvent = { type: 'usage', inputTokens: 0, outputTokens: 0 };
  try {
    const stream = await buildAgentGraph(graphInput).stream(
      { messages: [new HumanMessage(question)] },
      { streamMode: ['messages', 'custom', 'updates'], recursionLimit: AGENT_RECURSION_LIMIT, signal },
    );
    for await (const [mode, chunk] of stream) {
      if (mode === 'messages') {
        const [message, metadata] = chunk;
        // Tool results are also streamed as messages; only the model's own text reaches the visitor.
        if (metadata.langgraph_node === AGENT_NODE) {
          const text = message.text;
          if (text) yield { type: 'token', text };
        }
      } else if (mode === 'custom') {
        if (isMapActionEvent(chunk)) yield chunk;
      } else if (mode === 'updates') {
        const agentUpdate = chunk[AGENT_NODE];
        if (agentUpdate?.messages) sumUsage(agentUpdate.messages, usage);
      }
    }
  } catch (error) {
    throw toProviderError(error);
  }
  yield usage;
}
