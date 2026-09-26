# Stage 16 report — M3: LangGraph graph + map-action tools + graph.test

## Files
server/package.json
package-lock.json
server/src/agent/graph.ts
server/src/agent/mapActionTools.ts
server/src/agent/chatModelFactory.ts
server/src/agent/__tests__/graph.test.ts
server/src/agent/__tests__/chatModelFactory.test.ts

## Summary
The agent now exists as a LangGraph graph (`START → agent ⇄ tools → END`). The model is bound to the two map-action tools, and its system prompt comes from stage 15's `buildSystemPrompt`. `streamAgentAnswer` runs the graph and yields token and action events in stream order, then one usage event. The tools check every id against the snapshot with Zod. Unknown ids are dropped and produce no action event. `highlight_services` keeps the known ids from a mixed list. A provider factory builds `ChatAnthropic` or `ChatOpenAI` from the cookie payload. Any failure is rethrown as a `ProviderError`. There is still no route and no client change.

Hand-written files: 5, within the ceiling of 6. `package.json` and `package-lock.json` changed because of the install.

| Gate (repo root) | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass: 0 errors, 2 warnings that were already there (AskPanel.tsx, Map.tsx) |
| `npm test` | pass: client 12/12, server 85/85 (10 new: graph 8, chatModelFactory 2) |
| `npm run build` | pass |
| `npm run validate` | pass, no drift |

Proof that the tests catch real breakage. Each mutation was applied from a scratchpad backup, run, restored, and `diff -q` confirmed the restore. Everything was green again afterwards.
- M1: `highlight_services` stops dropping unknown ids → 2 highlight tests fail.
- M2: `play_scenario` skips id validation → "drops an unknown scenario id" fails.
- M3: the token filter stops checking `langgraph_node === 'agent'` → the tokens test fails, because the tool confirmation text leaks as a token. My first version of this filter also had an AIMessage-instance check. That made the node check redundant, and this mutation survived. I simplified the filter to the node check alone, and the mutation now fails.
- M4a: the OpenAI factory uses LangChain's `reasoning: { effort: 'none' }` + `maxTokens` → the factory test fails (no `reasoning_effort` is sent).
- M4b: `maxTokens` is added next to `modelKwargs` → the factory test fails (`max_tokens` is sent).

## Commit message
feat(server): add LangGraph agent with map-action tools

Wires the agent loop stage 17's /api/ai/ask will stream: the visitor's model is bound
to highlight_services / play_scenario, which drop any id not in the map snapshot, so
the agent can only ever point at things that exist on the map.

## Key decisions
**API for stage 17** (`server/src/agent/graph.ts`, `chatModelFactory.ts`, `mapActionTools.ts`):
- `createChatModel(payload: AiCookiePayload): BaseChatModel`. Pass it the decrypted cookie payload.
- `streamAgentAnswer(input: AgentAnswerInput): AsyncGenerator<AgentStreamEvent>`, where `AgentAnswerInput = { model; snapshot: CosmosMapSnapshot; hints: AgentHints; question: string; signal?: AbortSignal }`. Stage 17 calls it with `{ model: createChatModel(payload), snapshot: cosmosMap, hints: decision.hints, question, signal }` when `decision.kind === 'agent'`.
- `AgentStreamEvent` has three members:
  - `{ type:'token'; text }`
  - `MapActionEvent`, which is either `{ type:'action'; kind:'highlight'; serviceIds: string[] }` or `{ type:'action'; kind:'playScenario'; scenarioId }`
  - `{ type:'usage'; inputTokens; outputTokens }`

  Every event is already shaped like its §7 NDJSON line, so stage 17 can write `JSON.stringify(event) + '\n'` and then add `done`/`error` itself.
- **Usage**: exactly one usage event, always last. It sums `usage_metadata` from every `agent` node update, across all tool rounds.
- **Errors**: `streamAgentAnswer` catches everything and rethrows `toProviderError(error)`. Stage 17 catches `ProviderError` and puts `.errorCode` on the `error` line. An aborted request also arrives as a `ProviderError` with `PROVIDER_ERROR`, so check `signal.aborted` to tell the two apart.
- Also exported: `buildAgentGraph({ model, snapshot, hints })`, `AGENT_NODE`, `TOOLS_NODE`, `AGENT_RECURSION_LIMIT = 8` (three tool rounds plus a final answer; going past it surfaces as `PROVIDER_ERROR`), `createMapActionTools(snapshot)`, `isMapActionEvent`, and the tool name constants.

**How it streams.** I checked the installed `@langchain/langgraph@1.4.18` types:
- `StreamMode` and `StreamOutputMap` in `dist/pregel/types.d.ts`: with multiple modes, `.stream()` yields `[mode, chunk]` tuples, and `messages` gives `[BaseMessage, metadata]`.
- `getWriter(config)` in `dist/pregel/utils/config.d.ts` returns `config.writer`, which is set only when `custom` mode is on.
- `ToolNode` and `toolsCondition` in `dist/prebuilt/tool_node.js`.

The graph streams with `['messages','custom','updates']`:
- Tokens come from `messages`, keeping only those whose `metadata.langgraph_node === 'agent'`, via `BaseMessage.text`, which skips tool-use JSON deltas.
- Actions come from `custom`. Each tool calls `getWriter(config)?.(event)`.
- Usage comes from `updates`.

**Snapshot validation.** Tool input schemas are plain strings, so the model can still name a bad id. Validation happens inside each tool with `z.enum(snapshot ids).safeParse`, which lets `highlight_services` keep the known ids from a mixed list. `play_scenario` accepts scenario **and incident** ids, the same set as `decideRoute`'s direct-action targets.

**Test model.** The fake model is `FakeStreamingChatModel` from `@langchain/core/utils/testing`. I checked its export and implementation in core 1.2.12. It always replays the same tool-call chunks, which would loop forever. The test subclasses it: it replays the chunks until a `ToolMessage` is present, then answers with text and usage. It also overrides `bindTools` to record the bound tool names. The tests make no network calls.

**OpenAI reasoning setting.** I chose Chat Completions with `reasoning_effort: 'none'`. This contradicts stage 15's suggestion. In `@langchain/openai@1.5.13`, `_getReasoningParams` and `isReasoningModel` (`dist/utils/misc.js`) recognise only `o*`/`gpt-5*` models. For `gpt-6-sol` that means:
- `reasoning`/`reasoningEffort` would be **silently dropped**.
- `maxTokens` would send `max_tokens` instead of `max_completion_tokens`.

So the factory passes `modelKwargs: { reasoning_effort: 'none', max_completion_tokens: 1024 }`. `chatModelFactory.test.ts` checks the actual `invocationParams()`. I rejected `useResponsesApi: true`: it goes through the same `_getReasoningParams`, so the model would run at its default reasoning effort, costing the visitor more money and adding latency.

**Other model settings.** Both models use `maxRetries: 1` because LangChain retries 429s by default, and `insufficient_quota` is a 429. Output is capped at 1024 tokens.

**Error shapes from stage 15: verified, no change to `providerErrors.ts`.**
- `@langchain/openai` `wrapOpenAIClientError` and `@langchain/anthropic` `wrapAnthropicClientError` **mutate the SDK error in place**. They add `lc_error_code` (`MODEL_AUTHENTICATION` for 401, `MODEL_RATE_LIMIT` for 429) and append a troubleshooting URL to `message`, while keeping `status`/`code`/`error`. They do not wrap errors with `cause` (only ContextOverflowError, which maps to PROVIDER_ERROR anyway).
- `openai@7.23.0` `APIError` sets `status`, `error` (the inner object) and `code = error.code`, which matches.
- `@anthropic-ai/sdk@0.122.0` was already verified in stage 15.

**Pinned versions** (exact, installed into `server/`):

| Package | Version |
|---|---|
| `@langchain/langgraph` | 1.4.18 |
| `@langchain/core` | 1.2.12 |
| `@langchain/anthropic` | 1.5.11 |
| `@langchain/openai` | 1.5.13 |

Transitive: `openai` 7.23.0 and `@anthropic-ai/sdk` 0.122.0.
