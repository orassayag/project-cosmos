# Stage 14 report — §5: classify.ts (JEV evaluate, 3s timeout, fallback, warn-once) + classify.test

## Files
server/package.json
package-lock.json
server/src/agent/classify.ts
server/src/agent/__tests__/classify.test.ts

## Summary
Added the free classification step that runs before any paid model call. `classifyQuestion(question, snapshot)` asks TypeSafe AI's JEV (through AI Gateway, on the site owner's key, with zero data retention) three questions: is it on-topic, what the visitor wants, and which scenario matches. It returns a stage-13 `RouteInput`, so the result goes straight into `decideRoute`.

If JEV is unavailable, the step uses the free `localRelevance` keyword check instead and never calls the visitor's model. "Unavailable" covers three cases: a gateway error, no answer within 3 seconds, or `AI_GATEWAY_API_KEY` not set. When the key is missing, JEV is not called at all. That case logs one `JEV_UNAVAILABLE` warning the first time only. A gateway error or timeout logs a warning every time it happens, so outages show up as spikes.

`ai` is installed at `^7.0.116` (latest; meets the plan's ≥ 7.0.105). I checked that `experimental_evaluate` exists and read its real signature in `node_modules/ai/dist/index.d.ts` and `node_modules/ai/docs/`:
- `abortSignal` is supported.
- Boolean answers carry `probability`.
- Choice answers carry `choice` and an **optional** `probabilities`.
- `@ai-sdk/gateway`'s `GatewayEvaluationModelId` names `'typesafe-ai/jev'`.

| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run build` | pass (only the existing Vite chunk-size notice) |
| `npm run lint` | pass: 0 errors, the same 2 exhaustive-deps warnings as before (AskPanel.tsx, Map.tsx) |
| `npm test` | pass: client 12/12, server 56/56 (8 files, 6 new tests) |
| `npm run validate` | pass: 0 errors, no drift |
| Non-vacuous proof | 5 mutations of `classify.ts`, each confirmed failing and then restored. `diff` against the backup was empty afterwards and 6/6 passed again. (1) Warn on every missing-key call: fails "warns once across two questions". (2) Call JEV even without a key: fails "never calls JEV". (3) Drop the timeout race and rely only on the abort signal: the timeout test hangs and fails. (4) Rethrow instead of falling back: 3 tests fail. (5) Stop mapping `none` to null: the none-mapping test fails. |

Test coverage in `classify.test.ts`:
- (a) JEV stubbed to throw: an off-topic question goes to the fallback and gets a joke answer, the visitor-model stub is never called, and exactly one `JEV_UNAVAILABLE` warning is logged. An on-topic question goes to the agent with null hints.
- (b) Key unset: JEV is never called, localRelevance decides both questions, and the warning is logged once across the two.
- Timeout case, using fake timers: the stub never resolves. At 3s the result falls back and the abort signal the stub received is aborted.
- Happy-path mapping: probabilities map correctly. The model id is `typesafe-ai/jev`. The `state` keys are names only. The criteria hold 1 `none` + 5 scenarios + 3 incidents. `providerOptions` sets zero retention.
- `none` target: maps to `targetScenarioId: null` with probability 0.

## Commit message
feat(server): classify questions with JEV and a free local fallback

The zero-visitor-token promise (I6) needs a classifier that runs on the owner's
gateway key and degrades to the free keyword check on error, timeout or a missing
key, never to the visitor's model. The output feeds decideRoute directly.

## Key decisions
Everything below is verified by typecheck and tests.

**`server/src/agent/classify.ts`**, which stage 17 calls:
- `export async function classifyQuestion(question: string, snapshot: CosmosMapSnapshot): Promise<RouteInput>`
  - It never throws. Every failure becomes `{ source: 'localRelevance', onTopic }`.
  - Stage 17 usage: `decideRoute(await classifyQuestion(question, cosmosMap), cosmosMap)`.
- `export const JEV_MODEL_ID = 'typesafe-ai/jev'`, `export const JEV_TIMEOUT_MS = 3000`, `export const JEV_UNAVAILABLE = 'JEV_UNAVAILABLE'`
- `export class JevTimeoutError extends Error` with `errorCode = 'JEV_UNAVAILABLE'`. It is the abort reason on timeout, and the catch block uses it to tell a timeout apart from a gateway error.

**Mapping JEV answers into `Classification`:**
- `onTopic.probability` becomes `onTopicProbability`.
- `intent.choice` becomes `intent`.
- `targetScenario.choice === 'none'` becomes `targetScenarioId: null`.
- `targetScenarioProbability` is `probabilities?.[choice] ?? 0`. **If JEV returns no distribution, the probability is 0, so no direct action is possible.** The installed types make the distribution optional, and an unknown confidence should not start a scenario playing.

**Choices and state:**
- The `targetScenario` choices are built from **scenarios + incidents** (id → title), plus `none`. This matches how `decideRoute` resolves targets.
- `state` = `{ question, serviceNames, topicNames, domainNames }`, where domains use `label`. It carries names only.

**Timeout:**
- A `setTimeout` aborts an `AbortController` (the signal is passed to `evaluate`) **and** rejects a promise that is raced against `evaluate`. The 3s limit therefore holds even if the provider ignores the abort.
- I used `setTimeout` instead of `AbortSignal.timeout` because Vitest fake timers can drive it.
- `maxRetries` is left at the SDK default (2), and the retries all fit inside the 3s limit.

**Warnings:**
- Missing key: warns once, tracked by a module-level `hasWarnedMissingGatewayKey` flag. Tests call `vi.resetModules()` to reset it.
- Gateway error or timeout: warns every time, so an outage shows up as a spike (the plan's "makes spikes visible").
- The log message includes only the error's `name`, never its message, in keeping with the logger allowlist and the no-PHI rule.

**Testing and model resolution:**
- Tests stub the SDK with `vi.mock('ai', () => ({ experimental_evaluate: vi.fn() }))` and use a fresh module import for each case.
- Model resolution: a plain string id resolves through AI Gateway when no `globalThis.AI_SDK_DEFAULT_PROVIDER` is set (installed evaluation guide, "Default-provider strings"). Gateway reads `AI_GATEWAY_API_KEY` from the environment itself; `getGatewayApiKey()` is only the gate that decides whether to call JEV at all.

## Open questions
- The installed reference page (`07-reference/01-ai-sdk-core/14-evaluate.mdx`) says "Evaluation never implicitly falls back to Gateway". The installed guide (`03-ai-sdk-core/32-evaluation.mdx`) says string ids resolve through Gateway when no default provider is configured. I followed the guide and the plan (a plain string). **This is not verified against the live gateway**, because no real call was made. If the first preview deploy logs `NoSuchModelError`/`NoSuchProviderError` as `JEV_UNAVAILABLE`, the fix is `gateway.evaluationModel('typesafe-ai/jev')` from `@ai-sdk/gateway`, which would need to become a direct server dependency.
- Gateway errors warn on every failure, while a missing key warns once. This is my reading of "warn-once" (scope bullet) together with "makes spikes visible" (§5). Say so if every `JEV_UNAVAILABLE` should be warn-once.
- Ceilings respected: 4 files. `classify.ts` is 134 lines and the test is 159.
