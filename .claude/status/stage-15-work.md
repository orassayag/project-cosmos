# Stage 15 work brief — M3: context digest, systemPrompt, models, providerErrors + context/providerErrors tests

Stage line: M3: context digest, systemPrompt, models, providerErrors + context/providerErrors tests

## Scope for this stage
- `server/src/agent/context.ts`: compact text digest of `cosmos-map.json` (per §6 "Knowledge" below), following the pattern of `drift-sync/scripts/lib/cosmos-context.ts`. Built once per cold start, cached in module scope. Covers services (id, name, domain, owner team, tech, what it talks to), topics (producers/consumers), scenarios (title + ordered step summaries), incidents (title, date, one-line cause). Take the snapshot as input (same `CosmosMapSnapshot` type stage 13 added in `server/src/agent/types/cosmosMapSnapshot.ts`; widen that type only if the digest needs fields it lacks) so tests can pass a fixture or the real snapshot.
- `server/src/agent/systemPrompt.ts`: the system prompt text (verbatim from §6 below), followed by the digest and the JEV hints (stage 13's `hints: { intent: Intent|null; targetScenarioId: string|null }` from `route.ts`). A pure builder function; stage 16's graph calls it.
- `server/src/agent/models.ts`: the default model id constants — Claude `claude-sonnet-5`; the OpenAI id **pinned from OpenAI's current model list** (verify from an authoritative source — the provider's docs/model list — and cite it in the report; if you cannot verify, say so under Open questions rather than guessing). The `ChatAnthropic`/`ChatOpenAI` provider factory and the `@langchain/*` package installs are **stage 16** (with the graph) — do not install LangChain packages here.
- `server/src/agent/providerErrors.ts`: pure function from a provider error to `errorCode` per the §7 table below, plus the typed `ProviderError(message, { errorCode, cause })` class. Accept the error structurally (e.g. `status`, `message`, and OpenAI's `code`/`error.code`) since both the Anthropic and OpenAI SDK error classes expose HTTP status; read the installed SDK/LangChain error shapes only if available — they are not installed yet, so design against the documented shapes and note that stage 16 should confirm them against the installed packages. Export the errorCode constants/type for stage 17.
- Tests in `server/src/agent/__tests__/`: `context.test.ts` (digest includes every service id from the real snapshot), `providerErrors.test.ts` (one case per table row, including OpenAI 429 *without* `insufficient_quota` → `RATE_LIMITED`).
- File ceiling: 6 files (4 source + 2 tests). If `cosmosMapSnapshot.ts` must widen, that is a 7th — acceptable but note it.
- NOT in scope: LangGraph graph / tools / provider factory (stage 16), `/api/ai/ask` + NDJSON stream (stage 17), client work (18–19).
- Every relative import under `server/` ends in `.js` (I12, NodeNext).

## Plan §6 excerpt (verbatim, stage-15 parts)
**Knowledge:** `server/src/agent/context.ts` builds a compact text digest from `cosmos-map.json`, following the pattern of `drift-sync/scripts/lib/cosmos-context.ts`. It covers each service (id, name, domain, owner team, tech, what it talks to), each topic (producers/consumers), each scenario (title plus ordered step summaries), and incidents (title, date, one-line cause). It is built once per cold start and cached in module scope.

**"The skill"** is the system prompt in `server/src/agent/systemPrompt.ts`: *"You are the guide to the AstroMart architecture shown on this map. Answer only from the map data below. When you mention specific services, call `highlight_services`. When the visitor would benefit from seeing a flow, call `play_scenario`. If the data doesn't cover the question, say so plainly. Keep answers under ~150 words."* It is followed by the digest and the JEV hints.

**Model:** a provider factory selects `ChatAnthropic` or `ChatOpenAI` from the cookie's provider, using the visitor's key. The default model ids are constants in `server/src/agent/models.ts`: Claude uses `claude-sonnet-5`, and the OpenAI id is pinned at implementation from OpenAI's current model list.

**Tests**
- `context.test.ts`: the digest includes every service id from the snapshot. *Protects: the agent never answers from a partial map.*

## Plan §7 excerpt (verbatim, error mapping)
**Error mapping** (`server/src/agent/providerErrors.ts`, a pure function from provider error to `errorCode`)

| Provider response | `errorCode` | Message shown in AskPanel |
|---|---|---|
| Anthropic 400 whose message contains "credit balance is too low"; OpenAI 429 with `code: 'insufficient_quota'` | `OUT_OF_CREDIT` | "Your AI account is out of credit — top it up with your provider, then ask again." |
| Any other 429 | `RATE_LIMITED` | "Too many questions at once — try again in a moment." |
| 401 | `INVALID_KEY` | "Your key no longer works." The response headers are already sent by then, so the server can't clear the cookie here; the client calls `POST /api/ai/disconnect` (which clears it) and then flips the light red. |
| Anything else | `PROVIDER_ERROR` | "The AI agent hit a problem — please try again." |

Errors thrown inside the server use a typed `ProviderError(message, { errorCode, cause })`.

**Tests** — `providerErrors.test.ts`: one case per table row, including an OpenAI 429 *without* `insufficient_quota` → `RATE_LIMITED`. *Protects: a visitor who is just going too fast is never told they're out of credit (I10).*

(The AskPanel messages are client-side, stage 19 — the server only produces the `errorCode`.)

## Relevant issue resolutions (verbatim)
| I5 | The agent's actual job is never defined | Claude | Fixed | Agent scope defined: knowledge snapshot, system prompt, map-action tools, graph. Design §6. |
| I10 | "No tokens left" is several different errors | Claude | Fixed | Three-way provider error mapping on the server. Design §7. |
| I12 | Server imports must end in `.js` on Vercel (see L016) | bank | Fixed | `.js` on every relative import under `server/`, enforced by the server's `moduleResolution: NodeNext`. Design §3. |
