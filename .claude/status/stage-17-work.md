# Stage 17 work brief — §7: POST /api/ai/ask NDJSON stream (classify → off-topic / direct / agent, usage, errors)

## Stage scope
Implement the `POST /api/ai/ask` route in `server/` (Hono app from stage 11, alongside the connect/disconnect/status routes from stage 12), streaming `application/x-ndjson`. Wire together the pieces built in stages 11–16:
- 503 `AI_NOT_CONFIGURED` without `AI_COOKIE_SECRET` (config from stage 11/12).
- 401 `NOT_CONNECTED` when there is no valid cookie — BEFORE JEV is called (abuse guard, §5). Tampered cookie = not connected, cleared.
- Validate the body `{ question }` with a Zod schema (named validation error on a bad body, same style as `ConnectRequestSchema`).
- `decideRoute(await classifyQuestion(question, cosmosMap), cosmosMap)`:
  - `offTopic` → stream a token line with the answer, then `done`; no usage line; visitor model never instantiated.
  - `directAction` → stream the templated line as a token + a `playScenario` action, then `done`; no usage line; visitor model never instantiated.
  - `agent` → `streamAgentAnswer({ model: createChatModel(payload), snapshot: cosmosMap, hints: decision.hints, question, signal })`; write each event as `JSON.stringify(event) + "\\n"`, then `done`.
- Errors mid-stream: catch `ProviderError` → `{"type":"error","errorCode":...}` line (then `done` per protocol — decide and document). Log only `{ errorCode, provider, noPHI: true }` via the structured logger. Aborted request (`signal.aborted`) is not an error to log as provider failure.
- Tests (Vitest, server, stubbing `classifyQuestion`/`createChatModel`/`streamAgentAnswer` as needed, no network): 503 without secret; 401 NOT_CONNECTED without cookie and JEV not called; off-topic stream has no usage and the model factory is never called; direct action streams token+action+done; agent path relays token/action/usage events in order then done; a ProviderError yields an error line with its errorCode; bad body → validation error. Non-vacuous proof via mutations, as prior stages did.
- Out of scope: any client change (stages 18–19).

## Plan text (pasted verbatim from docs/plans/add-ai.md)

### §3 — Milestone 2: Server (key handling)

**Stack:** a Node service in `server/`. Use Hono on Vercel's Node runtime (Node 24 on Vercel, 22 locally per `.nvmrc`). Set root `engines.node` to `>=22`, because AI SDK 7 requires Node 22+ and ESM. In `server/tsconfig.json`, set `module`/`moduleResolution: NodeNext`. That makes every extensionless relative import a compile error, so the `.js` rule (L016) is enforced by the type-checker instead of discovered at deploy time.

**Routes**

| Route | Behaviour |
|---|---|
| `POST /api/ai/connect` `{ provider: 'anthropic' \| 'openai', apiKey }` | Validates the body with a Zod `ConnectRequestSchema`. Checks the key with the provider's free `GET /v1/models` (Anthropic `x-api-key` + `anthropic-version`; OpenAI `Authorization: Bearer`). A 401 returns `400 { errorCode: 'INVALID_KEY' }`. On success it sets the cookie, replacing any existing provider, and returns `{ connected: true, provider }`. |
| `POST /api/ai/disconnect` | Clears the cookie (`Max-Age=0`). Returns `{ connected: false }`. |
| `GET /api/ai/status` | No cookie returns `{ connected: false }`. Otherwise it decrypts the cookie and repeats the `/v1/models` check. A 401 clears the cookie and returns `{ connected: false, reason: 'KEY_REVOKED' }`. A network error keeps it connected, since the check is advisory. |
| `POST /api/ai/ask` `{ question }` | Streamed. See §5–§7. |

**Cookie:** `cosmos_ai=<base64url(iv ‖ ciphertext ‖ authTag)>; HttpOnly; Secure; SameSite=Strict; Path=/api/ai; Max-Age=2592000`. The payload is `{ provider, apiKey }` encrypted with AES-256-GCM using `AI_COOKIE_SECRET` through Node's built-in `crypto`. A tampered or undecryptable cookie is treated as "not connected" and cleared. The server stores nothing: it decrypts per request, uses the key, and drops it.

**Logging:** use a structured logger. It never logs request bodies, headers, or the cookie. Error logs carry only `{ errorCode, provider, noPHI: true }`.

**Tests** — `server/src/__tests__/`, Vitest, unit layer:
- `cookieCrypto.test.ts`: encrypt → decrypt round-trip. A flipped byte in the ciphertext or auth tag is rejected. A wrong secret is rejected. *Protects: a forged or tampered cookie can never be read as a valid key.*
- `connectRoute.test.ts`, with the provider `fetch` stubbed: a valid key sets a cookie with all four attributes; a 401 returns `INVALID_KEY` and sets no cookie; a bad body returns a named validation error. *Protects: only working keys get stored, and the cookie is always locked down.*
- `statusRoute.test.ts`: a revoked key (stub returns 401) clears the cookie and reports disconnected. *Protects: the light never stays green on a dead key (I9).*
- `config.test.ts`: the app module imports with neither env var set; `status`/`connect`/`ask` return `503 AI_NOT_CONFIGURED` without `AI_COOKIE_SECRET`; `disconnect` still returns 200. *Protects: a missing secret disables AI only, never the whole site (round-2 I1).*

### §5 — Classification with JEV (the free gate before any paid call)

**Package:** `ai` ≥ 7.0.105 (adds `experimental_evaluate`) in `server/`. Model id `'typesafe-ai/jev'` as a plain string, so AI SDK routes it through AI Gateway using `AI_GATEWAY_API_KEY`. Pass `providerOptions: { gateway: { zeroDataRetention: true } }`, because visitor questions should not be retained. Cost is $0.042 per 1M input tokens, paid by the site owner, with no output charge. The visitor spends nothing on classification.

One `evaluate` call per question. All questions are evaluated in parallel, so this is one round-trip:

```ts
const classification = await evaluate({
  model: 'typesafe-ai/jev',
  state: { question, serviceNames, topicNames, domainNames },
  questions: {
    onTopic: {
      type: 'boolean',
      instructions: 'Is this question about the AstroMart system shown on the map — its services, topics, flows, teams, or incidents?',
      criteria: { true: 'About the map/architecture', false: 'Unrelated (weather, jokes, general trivia, other companies)' },
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
      criteria: { none: 'No specific scenario', ...scenarioCriteriaFromSnapshot },
    },
  },
  providerOptions: { gateway: { zeroDataRetention: true } },
});
```

`state` carries names only, never the full snapshot, which keeps the input small (the "keep state focused" guidance). `targetScenario` options are generated from `cosmos-map.json`, with one entry per scenario (id → title). There are 8 today, well under the 255-option limit.

**Routing decision** (`server/src/agent/route.ts`, a pure function)
- `onTopic.probability < 0.35` → **off-topic**: return a random line from `OFF_TOPIC_ANSWERS`, the same self-aware humour as today's `DEMO_ANSWERS` ("I only know about stars on this map — for the weather, try looking up. ☁️"). The visitor's model is not called.
- `intent = playScenario` **and** `targetScenario ≠ none` with probability ≥ 0.6 → a **direct action**: stream a short templated line ("Playing *Checkout* for you ▶") and a `playScenario` action. The visitor's model is not called.
- Otherwise → **agent** (§6), with `intent` and `targetScenario` passed in as hints.

**Fallback when JEV is unavailable** (gateway error, timeout > 3s, or `AI_GATEWAY_API_KEY` not set — the last one skips the `evaluate` call entirely): run `localRelevance(question, snapshot)`. This is a free check that is on-topic when the question contains any service, topic, domain, team, or scenario name, or an architecture word from a short fixed list. Off-topic → funny reply; on-topic → agent. **The fallback never calls the visitor's model to classify.** That is the I6 guarantee, and a warning log (`JEV_UNAVAILABLE`) makes spikes visible.

**Abuse guard (proportionate):** `/api/ai/ask` returns `401 NOT_CONNECTED` before calling JEV when there is no valid cookie, so the owner's gateway key is only spent for visitors who have already proved they own a working provider key. Set a monthly budget on the AI Gateway key in the Vercel dashboard. That is a one-time manual step, listed in the hand-off.

**Tests** — `server/src/agent/__tests__/`
- `route.test.ts`: a table of classification results mapped to decisions, covering the threshold edges (0.34 / 0.35, 0.59 / 0.6). *Protects: the off-topic and direct-action rules never drift.*
- `classify.test.ts`, with `evaluate` stubbed to throw: the question falls back to `localRelevance`, the visitor-model stub is **never called** for an off-topic question, and a `JEV_UNAVAILABLE` warning is logged. *Protects: the zero-visitor-token promise holds without JEV (I6's adversarial case).*
- `classify.test.ts` also covers `AI_GATEWAY_API_KEY` unset: `evaluate` is never called, `localRelevance` decides, and the warning is logged once across two questions.
- `localRelevance.test.ts`: "what's the weather" → off; "what does payments-gateway do" → on.

### §6 — Milestone 3: The agent (LangChain + LangGraph)

**Packages** (in `server/`): `@langchain/langgraph`, `@langchain/core`, `@langchain/anthropic`, `@langchain/openai`. Pin the exact versions resolved at install time. Before writing the graph, read the installed packages' type definitions for the streaming API, and don't rely on recalled signatures.

**Knowledge:** `server/src/agent/context.ts` builds a compact text digest from `cosmos-map.json`, following the pattern of `drift-sync/scripts/lib/cosmos-context.ts`. It covers each service (id, name, domain, owner team, tech, what it talks to), each topic (producers/consumers), each scenario (title plus ordered step summaries), and incidents (title, date, one-line cause). It is built once per cold start and cached in module scope.

**"The skill"** is the system prompt in `server/src/agent/systemPrompt.ts`: *"You are the guide to the AstroMart architecture shown on this map. Answer only from the map data below. When you mention specific services, call `highlight_services`. When the visitor would benefit from seeing a flow, call `play_scenario`. If the data doesn't cover the question, say so plainly. Keep answers under ~150 words."* It is followed by the digest and the JEV hints.

**Model:** a provider factory selects `ChatAnthropic` or `ChatOpenAI` from the cookie's provider, using the visitor's key. The default model ids are constants in `server/src/agent/models.ts`: Claude uses `claude-sonnet-5`, and the OpenAI id is pinned at implementation from OpenAI's current model list.

**Graph** (`server/src/agent/graph.ts`): `START → agent ⇄ tools → END`. `agent` is the chat model bound to two tools, and `tools` runs them. The classification step (§5) runs before the graph is entered, so an off-topic question never instantiates a model.

**Map-action tools (A1):**
- `highlight_services({ serviceIds: string[] })`: validated against snapshot ids with Zod; unknown ids are dropped.
- `play_scenario({ scenarioId: string })`: validated against snapshot scenario ids.

Each tool returns a short confirmation to the model and emits an `action` event onto the response stream.

**Client side of actions:**
- `client/src/map/Map.tsx`: the prop `askFocusId?: string | null` (`Map.tsx:126`, default at `:160`) becomes `askFocusIds?: string[]` (default `[]`). `askTouches` (`Map.tsx:700-711`) seeds its set with every id and adds the neighbours of each; it returns `null` when the list is empty.
- `client/src/App.tsx`: `askFocusId` state (`App.tsx:371`) becomes `askFocusIds: string[]`. When disconnected, `handleAsk` keeps today's behaviour as a one-element list with the random id. When connected, it starts empty and each `highlight` action replaces it with the received `serviceIds`. The prop passed at `App.tsx:625` becomes `askFocusIds={askAnswering ? askFocusIds : []}`.
- `playScenario` goes through the same selection path the deep-link hook uses (`client/src/hooks/useDeepLink.ts`) to start a scenario.

**Tests**
- `graph.test.ts`, with a fake chat model (LangChain's fake tool-calling model from `@langchain/core` testing utilities) that emits a `play_scenario` tool call: the stream contains an `action` event with that scenario id, and an unknown id is dropped. *Protects: the agent can only ever point at things that exist on the map.*
- `context.test.ts`: the digest includes every service id from the snapshot. *Protects: the agent never answers from a partial map.*
- `client/src/map/__tests__/askTouches.test.ts` (extract `askTouches` into a pure `computeAskTouches(ids, edges)` in `client/src/map/` so it is testable without rendering the SVG): two ids yield both ids plus both neighbourhoods; `[]` yields `null`. *Protects: every service the agent names glows, not just the first (round-2 I2).*

### §7 — Streaming protocol, errors, and usage

`POST /api/ai/ask` responds with `Content-Type: application/x-ndjson`, one JSON event per line:

```
{"type":"token","text":"The checkout flow starts at"}
{"type":"action","kind":"highlight","serviceIds":["checkout","payments-gateway"]}
{"type":"action","kind":"playScenario","scenarioId":"checkout"}
{"type":"usage","inputTokens":1180,"outputTokens":142}
{"type":"error","errorCode":"OUT_OF_CREDIT"}
{"type":"done"}
```

**A2 streaming:** `AskPanel` replaces its fake word timer, when connected, with a reader over `response.body`. Tokens append as they arrive, the thinking dots show until the first token, and `onAnswerStart` fires on the first token. When disconnected, the existing fake typing stays.

**A4 usage:** a small muted line under the answer reads "≈ 1,322 tokens". It is built from the `usage` event (input + output, formatted with `Intl.NumberFormat`). Off-topic and direct-action replies show nothing, since they cost the visitor nothing.

**Error mapping** (`server/src/agent/providerErrors.ts`, a pure function from provider error to `errorCode`)

| Provider response | `errorCode` | Message shown in AskPanel |
|---|---|---|
| Anthropic 400 whose message contains "credit balance is too low"; OpenAI 429 with `code: 'insufficient_quota'` | `OUT_OF_CREDIT` | "Your AI account is out of credit — top it up with your provider, then ask again." |
| Any other 429 | `RATE_LIMITED` | "Too many questions at once — try again in a moment." |
| 401 | `INVALID_KEY` | "Your key no longer works." The response headers are already sent by then, so the server can't clear the cookie here; the client calls `POST /api/ai/disconnect` (which clears it) and then flips the light red. |
| Anything else | `PROVIDER_ERROR` | "The AI agent hit a problem — please try again." |

Errors thrown inside the server use a typed `ProviderError(message, { errorCode, cause })`.

**Tests** — `providerErrors.test.ts`: one case per table row, including an OpenAI 429 *without* `insufficient_quota` → `RATE_LIMITED`. *Protects: a visitor who is just going too fast is never told they're out of credit (I10).*

Client — `client/src/components/__tests__/AskPanel.test.tsx`: a stubbed stream that emits `{"type":"error","errorCode":"INVALID_KEY"}` triggers exactly one `POST /api/ai/disconnect` and leaves `useAiConnection` in `disconnected`. *Protects: a key found dead mid-answer is logged out before the next question (round-2 I4).*

