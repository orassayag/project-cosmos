# Stage 15 report — M3: context digest, systemPrompt, models, providerErrors + tests

## Files
server/src/agent/context.ts
server/src/agent/systemPrompt.ts
server/src/agent/models.ts
server/src/agent/providerErrors.ts
server/src/agent/types/cosmosMapSnapshot.ts
server/src/agent/__tests__/context.test.ts
server/src/agent/__tests__/providerErrors.test.ts

## Summary
Built the agent's knowledge, its instructions, its default models, and its error translation. Nothing is wired to a route yet; stage 16 (graph) and stage 17 (`/api/ai/ask`) call these.

- **Map digest (`context.ts`).** Turns the committed map snapshot into compact text. It covers every service (id, name, role, domains, owner team, tech, what it calls, publishes, and consumes), every Kafka topic (producers and consumers), every scenario (title plus numbered steps), and every incident (title, date, one-line cause, then its steps). It is built once per snapshot object and cached in module scope, so the committed map builds it once per cold start.
- **System prompt (`systemPrompt.ts`).** The plan's prompt text verbatim, then the digest, then the classifier hints. Hints are labelled as possibly wrong. Missing hints read "unknown" / "none".
- **Default models (`models.ts`).** Claude `claude-sonnet-5` and OpenAI `gpt-6-sol`. Both were checked against the providers' own model pages today.
- **Provider errors (`providerErrors.ts`).** Turns any provider failure into one of four codes: out of credit, rate limited, invalid key, or generic provider error. It also has a typed `ProviderError` whose message never repeats the provider's text, because OpenAI's 401 message includes part of the visitor's key.
- **Snapshot type widened** (7th file, allowed by the brief). The digest needs the service, topic, step, and incident fields the stage-13 type lacked. `route`, `localRelevance`, and `classify` still typecheck against it unchanged.

| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass: 0 errors, the same 2 exhaustive-deps warnings as before (AskPanel.tsx, Map.tsx) |
| `npm test` | pass: client 12/12, server 75/75 (10 files, 19 new tests) |
| `npm run build` | pass (only the existing Vite chunk-size notice) |
| `npm run validate` | pass: 0 errors, no drift |
| Non-vacuous proof | 3 mutations, each confirmed failing, then restored. `diff` against the scratchpad backups was clean and 75/75 passed afterwards. (1) Drop the first service from the digest: fails "lists every service id" (`['storefront']` missing). (2) Map every 429 to `OUT_OF_CREDIT`: fails "OpenAI 429 without insufficient_quota → RATE_LIMITED" and "Anthropic 429 → RATE_LIMITED". (3) Stop following `cause`: fails "reads through a wrapper". |

## Commit message
feat(server): add agent map digest, system prompt, and error mapping

The agent must answer only from the full map (I5) and tell a visitor who is
merely rate-limited apart from one who is out of credit (I10). This adds the
pure pieces the stage-16 graph and stage-17 ask route build on.

## Key decisions
**Exported API for stages 16–17** (verified by typecheck and tests):

`server/src/agent/context.ts`
- `buildMapDigest(snapshot: CosmosMapSnapshot): string`: pure, uncached.
- `getMapDigest(snapshot: CosmosMapSnapshot): string`: cached in a module-scope `WeakMap`. Stage 17 should call `getMapDigest(cosmosMap)` with the imported JSON.

`server/src/agent/systemPrompt.ts`
- `SYSTEM_PROMPT_INSTRUCTIONS: string`: plan §6 text verbatim, including the backticked tool names `highlight_services` and `play_scenario`. **Stage 16's tools must use those exact names.**
- `interface SystemPromptInput { digest: string; hints: AgentHints }`
- `buildSystemPrompt({ digest, hints }): string`, where `AgentHints` comes from `route.ts`. Output layout: instructions, a blank line, `# Map data`, the digest, then `## Routing hints (...)` with `- likely intent: <intent|unknown>` and `- likely scenario: <id|none>`.

`server/src/agent/models.ts`
- `CLAUDE_DEFAULT_MODEL_ID = 'claude-sonnet-5'`
- `OPENAI_DEFAULT_MODEL_ID = 'gpt-6-sol'`
- `DEFAULT_MODEL_IDS: { anthropic; openai }`, which `satisfies Record<AiProvider, string>`.

`server/src/agent/providerErrors.ts`
- `PROVIDER_ERROR_CODES = ['OUT_OF_CREDIT','RATE_LIMITED','INVALID_KEY','PROVIDER_ERROR'] as const` and `type ProviderErrorCode`.
- `class ProviderError extends Error`: constructor `(message, { errorCode, cause? })` with a `readonly errorCode`. `cause` goes to native `Error.cause`.
- `mapProviderError(error: unknown): ProviderErrorCode`: pure and never throws. An existing `ProviderError` keeps its code.
- `toProviderError(error: unknown): ProviderError`: wraps with a fixed, safe message per code and keeps the original as `cause`. Stage 17 should put `errorCode` in the NDJSON error event and log only `errorCode`/`provider`.

**Digest shape.** Markdown sections: `## Services (N)`, `## Kafka topics (N)`, `## Scenarios (N) — ordered steps`, and `## Incidents (N)`. Each entry line starts with `- <id>`.
- A service entry has 3 lines: role, then `domains | owner | tech`, then `calls | publishes | consumes`.
- Domain ids are shown as their labels. A name is shown only when it differs from the id.
- A step reads `N. from → to [through X] [via topic]: label`.
- For an incident's "one-line cause" I used its `note`, collapsed to one line. The snapshot has no separate cause field, and the note's first sentence is the symptom rather than the cause.
- Descriptions (`desc`) and step `plain` text are left out to keep the digest compact. It holds ids, relations, labels, and titles only.

**Error shapes accepted.** Read structurally at the top level and then down the `cause` chain, up to 5 levels:
- status: `status`, then `statusCode`, then `response.status`, then LangChain `lc_error_code` (`MODEL_AUTHENTICATION` → 401, `MODEL_RATE_LIMIT` → 429).
- codes: `code`, `error.code`, `error.error.code`.
- messages: `message`, `error.message`, `error.error.message`.

Rules are applied in the §7 table's order: 400 + "credit balance is too low" (case-insensitive) → `OUT_OF_CREDIT`; 429 + `insufficient_quota` → `OUT_OF_CREDIT`; any other 429 → `RATE_LIMITED`; 401 → `INVALID_KEY`; anything else → `PROVIDER_ERROR`.

What is verified and what is assumed:
- **Verified:** the Anthropic shape, against the installed `@anthropic-ai/sdk@0.122.0` (root devDependency). `APIError` has `status`, `error` (the response body `{type, error:{type, message}}`), and `message = "<status> <body JSON>"`, so the credit phrase shows up in either place.
- **Assumed from openai-node's documented shape** (not installed): OpenAI `APIError` with `status`, `code`, and `error` (inner object).
- **Assumed:** LangChain's `lc_error_code` values, and that LangChain rethrows the SDK error itself or wraps it with `cause`.
- **Stage 16 must confirm** all of the assumed items against the installed `@langchain/anthropic` and `@langchain/openai` packages. A test that throws a real SDK error class through the provider factory would settle it.

**Model ids and sources** (both fetched 2026-09-26):
- `claude-sonnet-5`: platform.claude.com/docs/en/models/overview lists "Claude API ID `claude-sonnet-5`" (Claude Sonnet 5, $2/$10 per MTok).
- `gpt-6-sol`: developers.openai.com/api/docs/models, which platform.openai.com/docs/models now 301-redirects to, lists GPT-6 Astra (`gpt-6-astra`, $10/$50), GPT-6 Sol (`gpt-6-sol`, $2/$10, "balance intelligence and cost"), and GPT-6 Luna (`gpt-6-luna`). Its model page says "Use `gpt-6-sol` in your API requests." I picked Sol over the recommended-default Astra because it matches Sonnet 5's price and tier, and the visitor pays for every answer.

## Open questions
- **`gpt-6-sol` tool calling on Chat Completions.** OpenAI's model page says it supports function calling via Chat Completions **only when `reasoning_effort` is `none`**, and otherwise through the Responses API. Stage 16's `ChatOpenAI` factory must either set `reasoningEffort: 'none'` or use `useResponsesApi: true`, or `highlight_services`/`play_scenario` may not fire. This is a stage-16 decision. Choose Astra instead if a stronger default is preferred; it costs 5x.
- OpenAI and LangChain error shapes are designed from documentation, not from installed packages. Stage 16 should confirm them (see Key decisions).
- The digest was not size-measured in tokens. It is ids, relations, and labels only, with no descriptions or step prose. Add `desc`/`plain` later if answers turn out too thin.
- Ceilings: 7 files (6 plus the allowed snapshot-type widening). All files are under 110 lines.
