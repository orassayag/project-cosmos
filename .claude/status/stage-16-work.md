# Stage 16 work brief — M3: LangGraph graph + highlight_services / play_scenario tools + graph.test

Stage-plan line: "Stage 16: M3: LangGraph graph + highlight_services / play_scenario tools + graph.test"

## Scope for this stage
- Install in `server/` (exact pinned versions as resolved): `@langchain/langgraph`, `@langchain/core`, `@langchain/anthropic`, `@langchain/openai`. Read the INSTALLED type definitions for the streaming API before writing the graph — never rely on recalled signatures.
- Provider factory: pick `ChatAnthropic` / `ChatOpenAI` from the cookie's provider using the visitor's key and the `DEFAULT_MODEL_IDS` from `server/src/agent/models.ts` (stage 15).
- `server/src/agent/graph.ts`: `START → agent ⇄ tools → END`, the model bound to the two tools, built with `buildSystemPrompt({ digest: getMapDigest(snapshot), hints })`.
- The two map-action tools `highlight_services` and `play_scenario` (exact names — the stage-15 system prompt names them), Zod-validated against snapshot ids; each returns a short confirmation to the model and emits an `action` event.
- Expose an event-producing API that stage 17's `POST /api/ai/ask` can serialize line-by-line into the §7 NDJSON protocol (token / action / usage events; errors surfaced as `ProviderError` via stage 15's `toProviderError`). The route itself, NDJSON serialization, and `done`/`error` lines are stage 17 — out of scope here.
- `server/src/agent/__tests__/graph.test.ts` as specified below.
- NOT in scope: `/api/ai/ask` route (stage 17), any client change (stages 18–19).

## Carried from stage 15 — must act on here
- `gpt-6-sol` supports tool calling on Chat Completions **only with `reasoning_effort: 'none'`**; the `ChatOpenAI` factory must set `reasoningEffort: 'none'` or use `useResponsesApi: true`, or the tools may not fire. Verify against the installed `@langchain/openai` types which option is available and pick one; record the choice.
- `providerErrors.ts` assumes OpenAI/LangChain error shapes from docs (`status`/`code`/`error` on OpenAI `APIError`; LangChain `lc_error_code` values `MODEL_AUTHENTICATION`/`MODEL_RATE_LIMIT`; LangChain rethrowing the SDK error or wrapping with `cause`). Confirm against the installed `@langchain/anthropic` / `@langchain/openai` (and their SDK deps). If a shape differs, fix `providerErrors.ts` minimally and add/adjust a test case; if it matches, record that it's verified.

## Plan text (verbatim) — §6 Milestone 3: The agent (LangChain + LangGraph)

**Packages** (in `server/`): `@langchain/langgraph`, `@langchain/core`, `@langchain/anthropic`, `@langchain/openai`. Pin the exact versions resolved at install time. Before writing the graph, read the installed packages' type definitions for the streaming API, and don't rely on recalled signatures.

**Knowledge:** `server/src/agent/context.ts` builds a compact text digest from `cosmos-map.json` [...] It is built once per cold start and cached in module scope. *(Done in stage 15.)*

**"The skill"** is the system prompt in `server/src/agent/systemPrompt.ts`: *"You are the guide to the AstroMart architecture shown on this map. Answer only from the map data below. When you mention specific services, call `highlight_services`. When the visitor would benefit from seeing a flow, call `play_scenario`. If the data doesn't cover the question, say so plainly. Keep answers under ~150 words."* It is followed by the digest and the JEV hints. *(Done in stage 15.)*

**Model:** a provider factory selects `ChatAnthropic` or `ChatOpenAI` from the cookie's provider, using the visitor's key. The default model ids are constants in `server/src/agent/models.ts`: Claude uses `claude-sonnet-5`, and the OpenAI id is pinned at implementation from OpenAI's current model list.

**Graph** (`server/src/agent/graph.ts`): `START → agent ⇄ tools → END`. `agent` is the chat model bound to two tools, and `tools` runs them. The classification step (§5) runs before the graph is entered, so an off-topic question never instantiates a model.

**Map-action tools (A1):**
- `highlight_services({ serviceIds: string[] })`: validated against snapshot ids with Zod; unknown ids are dropped.
- `play_scenario({ scenarioId: string })`: validated against snapshot scenario ids.

Each tool returns a short confirmation to the model and emits an `action` event onto the response stream.

**Tests**
- `graph.test.ts`, with a fake chat model (LangChain's fake tool-calling model from `@langchain/core` testing utilities) that emits a `play_scenario` tool call: the stream contains an `action` event with that scenario id, and an unknown id is dropped. *Protects: the agent can only ever point at things that exist on the map.*

## Plan text (verbatim) — §7 stream protocol (the events this stage must be able to produce; serialization is stage 17)

`POST /api/ai/ask` responds with `Content-Type: application/x-ndjson`, one JSON event per line:

```
{"type":"token","text":"The checkout flow starts at"}
{"type":"action","kind":"highlight","serviceIds":["checkout","payments-gateway"]}
{"type":"action","kind":"playScenario","scenarioId":"checkout"}
{"type":"usage","inputTokens":1180,"outputTokens":142}
{"type":"error","errorCode":"OUT_OF_CREDIT"}
{"type":"done"}
```

Errors thrown inside the server use a typed `ProviderError(message, { errorCode, cause })`.

## Relevant plan invariants
- I12: `.js` on every relative import under `server/` (`moduleResolution: NodeNext`).
- Server logging only through `server/src/logger.ts`; log only `errorCode`/`provider`/`noPHI` — never the key or provider text.
- Demo data stays fictional (AstroMart).
