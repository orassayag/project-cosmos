import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { AIMessage, AIMessageChunk, HumanMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { ChatGenerationChunk } from '@langchain/core/outputs';
import type { StructuredTool } from '@langchain/core/tools';
import { FakeStreamingChatModel, type ToolSpec } from '@langchain/core/utils/testing';
import { describe, expect, it } from 'vitest';
import { getCosmosView } from '../../cosmos/view.js';
import { AGENT_TOOL_NAMES, streamAgentAnswer, type AgentStreamEvent } from '../graph.js';
import {
  HIGHLIGHT_SERVICES_TOOL_NAME,
  OPEN_CHANGELOG_ENTRY_TOOL_NAME,
  OPEN_PASSPORT_TOOL_NAME,
  PLAY_SCENARIO_TOOL_NAME,
  SHOW_BLAST_RADIUS_TOOL_NAME,
  SHOW_HEALTH_TOOL_NAME,
  SHOW_OWNERSHIP_TOOL_NAME,
} from '../mapActionTools.js';
import { getMapSnapshot } from '../mapSnapshot.js';
import { ProviderError } from '../providerErrors.js';
import {
  BLAST_RADIUS_TOOL_NAME,
  DRIFT_TOOL_NAME,
  GET_SERVICE_TOOL_NAME,
  GET_STEPS_TOOL_NAME,
  ON_CALL_TOOL_NAME,
  WHO_OWNS_TOOL_NAME,
} from '../readTools.js';
import type { ChatMessage } from '../../schemas/askRequestSchema.js';

const view = getCosmosView();
const cosmosMap = getMapSnapshot(view);

const KNOWN_SCENARIO_ID = cosmosMap.scenarios[0].id;
const KNOWN_INCIDENT_ID = cosmosMap.incidents[0].id;
const [FIRST_SERVICE_ID, SECOND_SERVICE_ID] = cosmosMap.services.map((service) => service.id);
const UNKNOWN_ID = 'death-star-reactor';
const FINAL_ANSWER = 'Here is the flow.';
const FINAL_USAGE = { input_tokens: 1180, output_tokens: 142, total_tokens: 1322 };
const NO_HINTS = { intent: null, targetScenarioId: null };

/**
 * LangChain's fake tool-calling model always replays the same chunks, which would loop agent ⇄ tools forever.
 * This variant replays them only until a tool result is in the conversation, then answers in plain text.
 */
class ScriptedToolCallingModel extends FakeStreamingChatModel {
  boundToolNames: string[] = [];
  receivedMessages: BaseMessage[][] = [];
  private readonly failure: unknown;

  constructor(toolCall: { name: string; args: Record<string, unknown> } | null, failure?: unknown) {
    const chunks = toolCall
      ? [new AIMessageChunk({ content: '', tool_calls: [{ ...toolCall, id: 'call-1', type: 'tool_call' }] })]
      : [];
    super({ chunks, sleep: 0 });
    this.failure = failure;
  }

  override bindTools(tools: (StructuredTool | ToolSpec)[]) {
    this.boundToolNames = tools.map((boundTool) => boundTool.name);
    return this.withConfig({});
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    this.receivedMessages.push(messages);
    if (this.failure) throw this.failure;
    if (this.chunks.length > 0 && !ToolMessage.isInstance(messages.at(-1))) {
      yield* super._streamResponseChunks(messages, options, runManager);
      return;
    }
    const chunk = new ChatGenerationChunk({
      message: new AIMessageChunk({ content: FINAL_ANSWER, usage_metadata: FINAL_USAGE }),
      text: FINAL_ANSWER,
    });
    yield chunk;
    await runManager?.handleLLMNewToken(FINAL_ANSWER, undefined, undefined, undefined, undefined, { chunk });
  }
}

async function collectEvents(
  model: ScriptedToolCallingModel,
  messages: ChatMessage[] = [{ role: 'user', content: 'show me' }],
): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = [];
  for await (const event of streamAgentAnswer({ model, view, hints: NO_HINTS, messages })) {
    events.push(event);
  }
  return events;
}

function actionEvents(events: AgentStreamEvent[]) {
  return events.filter((event) => event.type === 'action');
}

describe('streamAgentAnswer', () => {
  it('binds exactly the reviewed allow-list of tools', async () => {
    const model = new ScriptedToolCallingModel(null);

    await collectEvents(model);

    expect(model.boundToolNames).toEqual([...AGENT_TOOL_NAMES]);
  });

  it('keeps the allow-list to the seven map actions, then the six read tools', () => {
    expect(AGENT_TOOL_NAMES).toEqual([
      HIGHLIGHT_SERVICES_TOOL_NAME,
      PLAY_SCENARIO_TOOL_NAME,
      SHOW_BLAST_RADIUS_TOOL_NAME,
      OPEN_PASSPORT_TOOL_NAME,
      SHOW_HEALTH_TOOL_NAME,
      SHOW_OWNERSHIP_TOOL_NAME,
      OPEN_CHANGELOG_ENTRY_TOOL_NAME,
      GET_SERVICE_TOOL_NAME,
      GET_STEPS_TOOL_NAME,
      BLAST_RADIUS_TOOL_NAME,
      WHO_OWNS_TOOL_NAME,
      ON_CALL_TOOL_NAME,
      DRIFT_TOOL_NAME,
    ]);
  });

  it('hands the whole chat history to the model in order, assistant turns as plain text', async () => {
    const model = new ScriptedToolCallingModel(null);
    const history: ChatMessage[] = [
      { role: 'user', content: 'what does payments do' },
      { role: 'assistant', content: 'It charges cards.' },
      { role: 'user', content: 'and who owns it?' },
    ];

    await collectEvents(model, history);

    const [, ...conversation] = model.receivedMessages[0];
    expect(conversation.map((message) => [message.constructor, message.text])).toEqual([
      [HumanMessage, 'what does payments do'],
      [AIMessage, 'It charges cards.'],
      [HumanMessage, 'and who owns it?'],
    ]);
    expect(conversation.some((message) => AIMessage.isInstance(message) && (message.tool_calls?.length ?? 0) > 0)).toBe(
      false,
    );
  });

  describe('play_scenario', () => {
    it('emits an action event for a scenario that exists on the map', async () => {
      const events = await collectEvents(
        new ScriptedToolCallingModel({ name: PLAY_SCENARIO_TOOL_NAME, args: { scenarioId: KNOWN_SCENARIO_ID } }),
      );

      expect(actionEvents(events)).toEqual([{ type: 'action', kind: 'playScenario', scenarioId: KNOWN_SCENARIO_ID }]);
    });

    it('treats incidents as playable', async () => {
      const events = await collectEvents(
        new ScriptedToolCallingModel({ name: PLAY_SCENARIO_TOOL_NAME, args: { scenarioId: KNOWN_INCIDENT_ID } }),
      );

      expect(actionEvents(events)).toEqual([{ type: 'action', kind: 'playScenario', scenarioId: KNOWN_INCIDENT_ID }]);
    });

    it('drops an unknown scenario id and still finishes the answer', async () => {
      const events = await collectEvents(
        new ScriptedToolCallingModel({ name: PLAY_SCENARIO_TOOL_NAME, args: { scenarioId: UNKNOWN_ID } }),
      );

      expect(actionEvents(events)).toEqual([]);
      expect(events).toContainEqual({ type: 'token', text: FINAL_ANSWER });
    });
  });

  describe('highlight_services', () => {
    it('keeps known service ids and drops unknown ones', async () => {
      const events = await collectEvents(
        new ScriptedToolCallingModel({
          name: HIGHLIGHT_SERVICES_TOOL_NAME,
          args: { serviceIds: [FIRST_SERVICE_ID, UNKNOWN_ID, SECOND_SERVICE_ID] },
        }),
      );

      expect(actionEvents(events)).toEqual([
        { type: 'action', kind: 'highlight', serviceIds: [FIRST_SERVICE_ID, SECOND_SERVICE_ID] },
      ]);
    });

    it('emits no action when every id is unknown', async () => {
      const events = await collectEvents(
        new ScriptedToolCallingModel({ name: HIGHLIGHT_SERVICES_TOOL_NAME, args: { serviceIds: [UNKNOWN_ID] } }),
      );

      expect(actionEvents(events)).toEqual([]);
    });
  });

  describe('view map actions', () => {
    const [driftEntry] = view.data.drift.entries;
    const [topic] = view.data.topics;

    it.each([
      [SHOW_BLAST_RADIUS_TOOL_NAME, { nodeId: topic.id }, { kind: 'showBlastRadius', nodeId: topic.id }],
      [OPEN_PASSPORT_TOOL_NAME, { nodeId: FIRST_SERVICE_ID }, { kind: 'openPassport', nodeId: FIRST_SERVICE_ID }],
      [SHOW_HEALTH_TOOL_NAME, {}, { kind: 'showHealth' }],
      [SHOW_OWNERSHIP_TOOL_NAME, {}, { kind: 'showOwnership' }],
      [OPEN_CHANGELOG_ENTRY_TOOL_NAME, { entryId: driftEntry.id }, { kind: 'openChangelogEntry', entryId: driftEntry.id }],
    ])('%s emits its action for a known id', async (name, args, action) => {
      const events = await collectEvents(new ScriptedToolCallingModel({ name, args }));

      expect(actionEvents(events)).toEqual([{ type: 'action', ...action }]);
    });

    it.each([
      [SHOW_BLAST_RADIUS_TOOL_NAME, { nodeId: UNKNOWN_ID }],
      [OPEN_PASSPORT_TOOL_NAME, { nodeId: UNKNOWN_ID }],
      [OPEN_CHANGELOG_ENTRY_TOOL_NAME, { entryId: UNKNOWN_ID }],
    ])('%s drops an unknown id and still finishes the answer', async (name, args) => {
      const events = await collectEvents(new ScriptedToolCallingModel({ name, args }));

      expect(actionEvents(events)).toEqual([]);
      expect(events).toContainEqual({ type: 'token', text: FINAL_ANSWER });
    });
  });

  it('streams the model text as tokens, never tool results, and ends with one usage event', async () => {
    const events = await collectEvents(
      new ScriptedToolCallingModel({ name: PLAY_SCENARIO_TOOL_NAME, args: { scenarioId: KNOWN_SCENARIO_ID } }),
    );

    expect(events.filter((event) => event.type === 'token')).toEqual([{ type: 'token', text: FINAL_ANSWER }]);
    expect(events.at(-1)).toEqual({ type: 'usage', inputTokens: 1180, outputTokens: 142 });
    expect(events.filter((event) => event.type === 'usage')).toHaveLength(1);
  });

  it('rethrows a provider failure as a ProviderError with the mapped errorCode', async () => {
    const unauthorized = Object.assign(new Error('401 invalid x-api-key sk-ant-secret'), { status: 401 });

    const failure = await collectEvents(new ScriptedToolCallingModel(null, unauthorized)).catch((error) => error);

    expect(failure).toBeInstanceOf(ProviderError);
    expect(failure).toMatchObject({ errorCode: 'INVALID_KEY' });
    expect(failure.message).not.toContain('sk-ant-secret');
  });
});
