# Stage 13 report — §5: route.ts decision, localRelevance, OFF_TOPIC_ANSWERS + tests

## Files
server/src/agent/route.ts
server/src/agent/localRelevance.ts
server/src/agent/offTopicAnswers.ts
server/src/agent/types/cosmosMapSnapshot.ts
server/src/agent/__tests__/route.test.ts
server/src/agent/__tests__/localRelevance.test.ts

## Summary
Built the server's question router (not wired to a route yet). `decideRoute` is a pure function that takes either a classifier result or the free keyword-check result and returns one of three decisions:
- **off-topic**: a random self-aware joke line, no model call
- **direct action**: "Playing *Title* for you ▶" plus a `playScenario` action, no model call
- **agent**: carries the intent and target-scenario hints

`localRelevance` is the free fallback check. It says a question is on-topic when any service, topic, domain, team, scenario or incident id/name, or a word from a short fixed architecture list, appears as whole words. It ignores case and separators, so "API Gateway" matches `api-gateway` and "orders.created" matches the topic. It avoids substring false positives ("cartoon" does not match `cart`). `OFF_TOPIC_ANSWERS` has 8 star/map-themed lines and includes the plan's example line verbatim.

| Gate | Result |
|---|---|
| `npm run typecheck` | pass (client + server + server/scripts) |
| `npm run build` | pass |
| `npm run lint` | pass: 0 errors, 2 warnings that were already there (AskPanel.tsx, Map.tsx exhaustive-deps) |
| `npm test` | pass: client 12/12, server 50/50 (7 files, 2 of them new) |
| `npm run validate` | pass: 0 errors, no drift |
| Non-vacuous proof | 3 mutations, each confirmed failing and then restored: `OFF_TOPIC_THRESHOLD` 0.35→0.34 fails "onTopic 0.34 is off-topic"; `DIRECT_ACTION_THRESHOLD` 0.6→0.59 fails "target probability 0.59 goes to the agent"; whole-word match → plain `includes(term)` fails the "cartoon" off-topic case. After restoring, grep shows the original constants and match expression, and 50/50 pass again. The new files are untracked, so `git diff` shows no change for them; the check was done by grep plus the test rerun. |

Tests covered for the plan's items: 0.34/0.35 and 0.59/0.6 threshold edges; "what's the weather" is off-topic; "what does payments-gateway do" is on-topic. It matches through the `payments` service, because the snapshot has no service literally named payments-gateway.

## Commit message
feat(server): add question routing decision and local relevance check

Off-topic and confident play-scenario questions must never reach the
visitor's model, and the no-classifier fallback must stay a free keyword
check (I6). One pure decision function serves both paths.

## Key decisions
Everything below is verified by typecheck and tests unless marked otherwise.

**`server/src/agent/route.ts`**
- `export const INTENTS = ['explainFlow','findService','playScenario','incident','ownership'] as const;` `export type Intent`
- `export const OFF_TOPIC_THRESHOLD = 0.35`, `export const DIRECT_ACTION_THRESHOLD = 0.6`. Off-topic is `<` 0.35; direct action is `>=` 0.6.
- `export interface Classification { onTopicProbability: number; intent: Intent; targetScenarioId: string | null; targetScenarioProbability: number }`. **Stage 14's `classify.ts` maps JEV output into this shape.** JEV's `none` choice becomes `targetScenarioId: null`. It carries no `ai` import and no JEV types.
- `export type RouteInput = { source: 'classifier'; classification: Classification } | { source: 'localRelevance'; onTopic: boolean }`. The fallback goes through the same function. `localRelevance` true gives an agent decision with null hints; false gives off-topic. The fallback can never produce a direct action.
- `export type RouteDecision =`
  - `{ kind: 'offTopic'; answer: string }`
  - `| { kind: 'directAction'; answer: string; action: { type: 'playScenario'; scenarioId: string } }`
  - `| { kind: 'agent'; hints: AgentHints }`
  - where `AgentHints = { intent: Intent | null; targetScenarioId: string | null }`
- `export function decideRoute(input: RouteInput, snapshot: Pick<CosmosMapSnapshot,'scenarios'|'incidents'>, pickIndex?: PickIndex): RouteDecision`
  - `PickIndex = (length) => number`. It defaults to `Math.random`, and the result is clamped into range.
- Target resolution: `targetScenarioId` is looked up across **scenarios + incidents**. The plan's "8 today" equals 5 scenarios + 3 incidents, and the client plays both.
  - An id that is not in the snapshot is dropped (hint becomes null, no direct action) instead of being played.
  - The direct-action title comes from the snapshot's `title`.

**`server/src/agent/localRelevance.ts`**
- `export function localRelevance(question: string, snapshot: CosmosMapSnapshot): boolean`
- Terms are cached per snapshot object in a `WeakMap`.
- Terms shorter than 3 characters are skipped.
- The architecture words are a fixed module-private list: architecture, astromart, service(s), microservice(s), topic(s), kafka, api, endpoint, queue, event(s), flow, scenario, incident, outage, owner, owns.

**`server/src/agent/offTopicAnswers.ts`**
- `export const OFF_TOPIC_ANSWERS: readonly string[]` (8 lines). The client's `DEMO_ANSWERS` is not imported.

**`server/src/agent/types/cosmosMapSnapshot.ts`**
- `export interface CosmosMapSnapshot`: a minimal readonly shape (domains/teams `{id,label}`, services/topics `{id,name}`, scenarios/incidents `{id,title}`).
- The imported `cosmos-map.json` (`with { type: 'json' }`) satisfies it structurally, as the tests confirm. Stage 17 can pass the JSON import directly.

## Open questions
- Unverified by design: how stage 17 renders the `*Title*` markdown in the streamed line. The plan text was copied literally.
- Including incidents as `targetScenario` options is my reading of the plan's "8 today". Stage 14 should generate the JEV choices from scenarios + incidents to match `decideRoute`.
- Ceilings respected: 6 files, about 150 hand-written LOC outside tests (286 total including tests).
