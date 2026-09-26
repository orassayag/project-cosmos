# Stage 13 work brief — §5: route.ts decision, localRelevance, OFF_TOPIC_ANSWERS + route/localRelevance tests

Plan: docs/plans/add-ai.md. Branch: feature/add-ai. Stage-plan line:
"Stage 13: §5: route.ts decision, localRelevance, OFF_TOPIC_ANSWERS + route/localRelevance tests"

## In scope for THIS stage
- `server/src/agent/route.ts` — the pure routing-decision function (below).
- `localRelevance(question, snapshot)` — the free keyword on-topic check (below), in its own module under `server/src/agent/`.
- `OFF_TOPIC_ANSWERS` — the self-aware humour lines, same tone as the client's existing `DEMO_ANSWERS` (find it under `client/src/` for the tone; do not import client code into server).
- Tests: `server/src/agent/__tests__/route.test.ts` and `server/src/agent/__tests__/localRelevance.test.ts`.

## Explicitly OUT of scope (later stages — do not build)
- `classify.ts`, the JEV `evaluate` call, the 3s timeout, the `JEV_UNAVAILABLE` warn-once, and installing the `ai` package → **stage 14**. So `route.ts` must NOT import from `ai`; define its own plain input type for the classification result (onTopic probability, intent, targetScenario + its probability) that stage 14's `classify.ts` will map JEV's output into.
- Context digest / system prompt / LangGraph → stages 15–16. `POST /api/ai/ask` → stage 17.

## Plan text (pasted verbatim from §5)

`state` carries names only, never the full snapshot, which keeps the input small (the "keep state focused" guidance). `targetScenario` options are generated from `cosmos-map.json`, with one entry per scenario (id → title). There are 8 today, well under the 255-option limit.

JEV questions stage 14 will ask (for the shape of the classification result):
- `onTopic`: boolean — "Is this question about the AstroMart system shown on the map — its services, topics, flows, teams, or incidents?"
- `intent`: choice — `explainFlow` | `findService` | `playScenario` | `incident` | `ownership`
- `targetScenario`: choice — `none` | one entry per scenario id from the snapshot

**Routing decision** (`server/src/agent/route.ts`, a pure function)
- `onTopic.probability < 0.35` → **off-topic**: return a random line from `OFF_TOPIC_ANSWERS`, the same self-aware humour as today's `DEMO_ANSWERS` ("I only know about stars on this map — for the weather, try looking up. ☁️"). The visitor's model is not called.
- `intent = playScenario` **and** `targetScenario ≠ none` with probability ≥ 0.6 → a **direct action**: stream a short templated line ("Playing *Checkout* for you ▶") and a `playScenario` action. The visitor's model is not called.
- Otherwise → **agent** (§6), with `intent` and `targetScenario` passed in as hints.

**Fallback when JEV is unavailable** (gateway error, timeout > 3s, or `AI_GATEWAY_API_KEY` not set — the last one skips the `evaluate` call entirely): run `localRelevance(question, snapshot)`. This is a free check that is on-topic when the question contains any service, topic, domain, team, or scenario name, or an architecture word from a short fixed list. Off-topic → funny reply; on-topic → agent. **The fallback never calls the visitor's model to classify.** That is the I6 guarantee, and a warning log (`JEV_UNAVAILABLE`) makes spikes visible.

**Tests** — `server/src/agent/__tests__/`
- `route.test.ts`: a table of classification results mapped to decisions, covering the threshold edges (0.34 / 0.35, 0.59 / 0.6). *Protects: the off-topic and direct-action rules never drift.*
- `localRelevance.test.ts`: "what's the weather" → off; "what does payments-gateway do" → on.

(I6 from Issue Resolutions: "Unrelated questions cost zero tokens" — the fallback is a free keyword check and never the visitor's model.)

## Design notes for this stage (orchestrator guidance; the plan wins any conflict)
- Keep `route.ts` pure and deterministic under test: inject the randomness for the off-topic pick (e.g. an optional `pickIndex`/random fn param) so tests don't depend on `Math.random`.
- The decision should carry everything stage 17 needs without re-deriving: off-topic → the answer text; direct → scenario id + the templated line (title from the snapshot); agent → the hints. Make the decision type a discriminated union.
- Make it easy for stage 14 to route the fallback through the same function (e.g. localRelevance result → off-topic / agent, never direct-action), so there is one decision path.
- The snapshot is `server/src/generated/cosmos-map.json` (committed; read its actual shape — services, topics, domains, owners/teams, scenarios). Type it minimally for what `localRelevance` and the scenario-title lookup need; don't retype the whole map.
- `localRelevance` matching: case-insensitive; be careful that service ids with hyphens ("payments-gateway") and display names both match; avoid substring false-positives on very short tokens where cheap to do so. Keep the architecture-word list short and fixed.
- Server rules from the ledger: `.js` suffix on every relative import (NodeNext), no `console.*` outside `logger.ts`, file names camelCase, tests in `__tests__/`, import `vitest` explicitly (no globals).
- Ceilings: ≤6 files, ≤250 hand-written LOC.
