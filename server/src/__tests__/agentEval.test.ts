import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { AIMessageChunk, SystemMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { ChatGenerationChunk } from '@langchain/core/outputs';
import type { StructuredTool } from '@langchain/core/tools';
import { FakeStreamingChatModel, type ToolSpec } from '@langchain/core/utils/testing';
import { describe, expect, it } from 'vitest';
import { streamAgentAnswer, type AgentStreamEvent } from '../agent/graph.js';
import { SHOW_BLAST_RADIUS_TOOL_NAME } from '../agent/mapActionTools.js';
import {
  BLAST_RADIUS_TOOL_NAME,
  DRIFT_TOOL_NAME,
  GET_STEPS_TOOL_NAME,
  ON_CALL_TOOL_NAME,
  findDrift,
  getOnCall,
  getService,
  whoOwns,
} from '../agent/readTools.js';
import { getCosmosView } from '../cosmos/view.js';

const view = getCosmosView();
const FINAL_ANSWER = 'Answered from the map.';
const NO_HINTS = { intent: null, targetScenarioId: null };
const MS_PER_DAY = 86_400_000;

interface ScriptedToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface ToolResult {
  name: string;
  content: string;
}

/**
 * Stands in for the visitor's LLM, like graph.test.ts: the first turn makes the scripted tool calls, and once their
 * results are in the conversation it records them and answers in plain text.
 */
class EvalChatModel extends FakeStreamingChatModel {
  systemPrompt = '';
  toolResults: ToolResult[] = [];

  constructor(toolCalls: ScriptedToolCall[]) {
    super({
      chunks: [
        new AIMessageChunk({
          content: '',
          tool_calls: toolCalls.map((toolCall, index) => ({ ...toolCall, id: `call-${index}`, type: 'tool_call' })),
        }),
      ],
      sleep: 0,
    });
  }

  override bindTools(_tools: (StructuredTool | ToolSpec)[]) {
    return this.withConfig({});
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const [systemMessage] = messages;
    if (SystemMessage.isInstance(systemMessage)) this.systemPrompt = systemMessage.text;
    if (!ToolMessage.isInstance(messages.at(-1))) {
      yield* super._streamResponseChunks(messages, options, runManager);
      return;
    }
    this.toolResults = messages
      .filter((message) => ToolMessage.isInstance(message))
      .map((message) => ({ name: message.name ?? '', content: message.text }));
    yield new ChatGenerationChunk({ message: new AIMessageChunk({ content: FINAL_ANSWER }), text: FINAL_ANSWER });
  }
}

async function ask(question: string, toolCalls: ScriptedToolCall[]) {
  const model = new EvalChatModel(toolCalls);
  const events: AgentStreamEvent[] = [];
  for await (const event of streamAgentAnswer({ model, view, hints: NO_HINTS, question })) {
    events.push(event);
  }
  const resultOf = (name: string) => {
    const result = model.toolResults.find((toolResult) => toolResult.name === name);
    if (!result) throw new Error(`The agent did not receive a ${name} result`);
    return JSON.parse(result.content);
  };
  return { model, events, resultOf };
}

function dayBefore(isoDate: string): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) - MS_PER_DAY).toISOString().slice(0, 10);
}

describe('agent eval (mocked LLM)', () => {
  it('"What changed in the Fulfillment Galaxy over the past 24 hours?" → drift since asOf − 24h', async () => {
    const since = dayBefore(view.derived.asOf);
    const { model, resultOf } = await ask('What changed in the Fulfillment Galaxy over the past 24 hours?', [
      { name: DRIFT_TOOL_NAME, args: { query: 'fulfillment', since } },
    ]);

    expect(model.systemPrompt).toContain(`As of: ${view.derived.asOf}`);
    const entries = resultOf(DRIFT_TOOL_NAME) as { id: string; title: string }[];
    expect(entries.map((entry) => entry.id)).toEqual(['d-2026-08-13-shipping-dispatched', 'd-2026-08-13-orders-payload']);
    expect(entries[0].title).toContain('shipping.dispatched');
    expect(entries[1].title).toContain('giftWrap');
  });

  it('"What breaks if payments goes down?" → exactly blastRadius["payments"], shown on the map', async () => {
    const { events, resultOf } = await ask('What breaks if payments goes down?', [
      { name: BLAST_RADIUS_TOOL_NAME, args: { nodeId: 'payments' } },
      { name: SHOW_BLAST_RADIUS_TOOL_NAME, args: { nodeId: 'payments' } },
    ]);

    expect(resultOf(BLAST_RADIUS_TOOL_NAME)).toStrictEqual(JSON.parse(JSON.stringify(view.derived.blastRadius.payments)));
    expect(events.filter((event) => event.type === 'action')).toEqual([
      { type: 'action', kind: 'showBlastRadius', nodeId: 'payments' },
    ]);
  });

  it('"Who is on call for payments?" → the payments team rotation from the health data', async () => {
    const { resultOf } = await ask('Who is on call for payments?', [
      { name: ON_CALL_TOOL_NAME, args: { serviceId: 'payments' } },
    ]);

    const payments = view.data.services.find((service) => service.id === 'payments');
    expect(payments?.team).toBeDefined();
    const answer = resultOf(ON_CALL_TOOL_NAME);
    expect(answer.onCall).toStrictEqual(view.data.health.onCallByTeam[payments!.team!]);
    expect(answer.onCall).toStrictEqual(view.derived.healthStatus.byService.payments.onCall);
  });

  it('"What does the checkout request body look like?" → the checkout step payload', async () => {
    const { resultOf } = await ask('What does the checkout request body look like?', [
      { name: GET_STEPS_TOOL_NAME, args: { playableId: 'shopping.place-order' } },
    ]);

    const checkoutStep = view.derived.playable.stepsById['shopping.place-order'].find((step) =>
      step.title.includes('checkout request'),
    );
    expect(checkoutStep?.payload).toBeDefined();
    const steps = resultOf(GET_STEPS_TOOL_NAME) as { title: string; payload?: string }[];
    expect(steps.find((step) => step.title === checkoutStep!.title)?.payload).toBe(checkoutStep!.payload);
  });

  it('reports an unknown id instead of inventing data', async () => {
    const { model } = await ask('What breaks if the death star goes down?', [
      { name: BLAST_RADIUS_TOOL_NAME, args: { nodeId: 'death-star' } },
    ]);

    expect(model.toolResults).toEqual([
      { name: BLAST_RADIUS_TOOL_NAME, content: 'No service or topic "death-star" exists on the map.' },
    ]);
  });
});

describe('read tools over the view', () => {
  it('get_service returns facts, owner, links and health, without geometry', () => {
    const service = getService(view, 'payments');

    expect(service).toMatchObject({
      id: 'payments',
      links: view.derived.serviceLinks.payments,
      health: view.derived.healthStatus.byService.payments,
      owner: { label: view.derived.ownership.byService.payments.label },
    });
    expect(service).not.toHaveProperty('x');
    expect(getService(view, 'death-star')).toBeNull();
  });

  it('who_owns resolves a topic to the owners of its producers', () => {
    const [topic] = view.data.topics;
    const owners = whoOwns(view, topic.id) as { topicId: string; producers: { serviceId: string }[] };

    expect(owners.topicId).toBe(topic.id);
    expect(owners.producers.map((producer) => producer.serviceId)).toEqual(view.derived.topicLinks[topic.id].producers);
  });

  it('on_call answers null for a service without a team', () => {
    const unowned = view.data.services.find((service) => !service.team);

    expect(unowned).toBeDefined();
    expect(getOnCall(view, unowned!.id)).toMatchObject({ onCall: null });
  });

  it('drift with no filters returns every entry, newest first, with links', () => {
    const entries = findDrift(view, {});

    expect(entries.map((entry) => entry.id)).toEqual(view.data.drift.entries.map((entry) => entry.id));
    expect(entries[0]).toMatchObject(view.derived.driftLinks[entries[0].id]);
  });
});
