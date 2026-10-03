# Stage 4 work brief — P3: Move derived logic to the server

Plan: docs/plans/server-owned-data-migration-plan.md (branch feature/add-ai). Stage plan line: P3: derive/* modules (graph, blastRadius, ownership, health, topicGroups, drift, playable) + getCosmosView() + derived parity ⚠ large (~900 LOC).

## Ground rules (pasted from plan)
### Ground rules for the executing agent

- Execute phases in order, one phase per branch or commit series; do not start a phase until the previous phase's acceptance passes. The plan targets v1.33.3+; if paths have moved, re-run the Phase 0 inventory and update paths first.
- `CLAUDE.md` wins on process: Conventional Commits, `scripts/version-note.sh write` before every commit, README check on every commit.
- Gates before every commit: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`. Never run `tsc` without `--noEmit`/`-b`.
- Repo invariants hold throughout: unique global `phaseId`; step `from`/`to`/`via`/`through` resolve; world 2400×1400; capsules ≥150px apart; AstroMart stays fictional.
- UI invariants hold throughout: mobile-first, one panel at a time on phones, top-right close control on every floating panel.
- Demo tours keep working after every phase: `?demo=all` ≤120s, `?demo=ai` ≤60s (`client/src/demo/__tests__/scripts.test.ts` or its current location guards them).
- The AstroMart map must look and behave identically after every phase.
- Ambiguity → smaller change, recorded in `docs/plans/server-owned-data-decisions.md`. Stop conditions are listed at the end.

## Phase 3 (pasted verbatim from plan)
### Phase 3 — Move derived logic to the server

Split rule: a fact about the system is server logic; geometry, paths, animation and layout overrides are client logic.

| `server/src/cosmos/derive/` | Ported from | Exposes |
| --- | --- | --- |
| `graph.ts` | `server/scripts/snapshot-map.ts`, logical part of `client/src/map/edge-builder.ts` | logical edges; `calls`/`publishes`/`consumes` per service; `connectedNodeIds` |
| `blastRadius.ts` | `client/src/map/blast-radius.ts` | `dependentsOf(nodeId)`, full map |
| `ownership.ts` | `client/src/scenarios/owners.ts` | `resolveOwner`, `groupServicesByTeam`, `ownerLabel` |
| `health.ts` | `client/src/scenarios/health.ts` helpers | status and on-call per service |
| `topicGroups.ts` | `client/src/map/topic-groups.ts` | groups from `groupServiceId` |
| `drift.ts` | `client/src/scenarios/drift.ts` helpers | latest entry, `searchDrift(query)`, prepared search text per entry, PR/commit URLs |
| `playable.ts` | `client/src/scenarios/data.ts`, `runner.ts` lookups | scenarios + incidents as one playable list; `stepsFor(id)` |

- `server/src/cosmos/view.ts`: `getCosmosView()` = data + all derived values, computed once, frozen, memoized. Pure functions only; no `client/` imports; no module-load side effects besides the memo.
- Port the existing client unit tests for these helpers to `server/src/cosmos/derive/__tests__/`. Extend `cosmosParity.test.ts`: every derived value equals the derived section of `baseline-full.json` — protects agent/UI agreement. Unit layer. Client copies stay until Phase 8.

**Acceptance:** derived parity passes for every node, team, service; existing client tests unchanged and green.

## Related plan constraints (pasted)
- Data only; leave `resolveOwner`, `groupServicesByTeam`, `driftEntryMatches`, PR/commit URL builders, `stepsForScenario` and health helpers for Phase 3. Do not copy `steps/core.ts`. Keep `color` unchanged for now.

## Stop and ask the owner if (pasted)
### Stop and ask the owner if

- A Phase 0 baseline command fails on `main`.
- A data value must change to make a test pass — **except** the two Phase 2 changes named above (`color`→`palette`, prefix rule→`groupServiceId`), which are proven by equivalence tests instead.
- Vercel's CDN does not serve a new `version` after a deploy, or cold starts stay slow after lazy imports.
- The gzip size of `/api/cosmos` is over 100 KB (I7).
- The production `version` does not match the build's `COSMOS_VERSION` (I6).
- The digest grows more than 50% and trimming would remove information.
- Any change seems to need a database, write endpoint, auth or shared package.
- A phase would change how the map looks or behaves for a visitor.

## Stage-specific notes from the orchestrator
- Prior stages' decisions log: docs/plans/server-owned-data-decisions.md — read it, and append a 'Phase 3' section for any judgment calls (smaller change when ambiguous).
- Phase 1 deferred to Phase 3: LATEST_DRIFT_*, KIND_SEVERITY, HEALTH_BY_SERVICE, HEALTH_STATUS_COUNTS, STEPS_BY_SCENARIO parity, and every helper (see decisions log ~lines 160–210).
- Phase 2 already made topicGroups data-driven via groupServiceId (client/src/map/topic-groups.ts) — port that, not the old prefix rule.
- Compare derived values against the derived section of server/src/__tests__/fixtures/baseline-full.json (current, post-Phase-2 fixture). Do not regenerate the fixture unless a Phase-2-allowed value requires it; any other value change is a STOP condition.
- Client copies stay untouched until Phase 8 — no client source changes in this stage (client tests must stay unchanged and green).
- Add a 'phase 3' entry to scripts/cosmos-check.ts (A3) if the plan's acceptance is greppable/checkable (e.g. derive modules exist, server/src/cosmos never imports client/).
- Gates: npm run build, typecheck, lint, npm test, npm run validate, npm run cosmos:check -- --phase 3 (and 0–2 stay green). parity:screens should be unaffected (no client change) — run it if cheap.
