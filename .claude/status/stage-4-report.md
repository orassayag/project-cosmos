# Stage 4 report — P3: Move derived logic to the server

## Files
server/src/cosmos/apiTypes.ts
server/src/cosmos/index.ts
server/src/cosmos/view.ts
server/src/cosmos/derive/graph.ts
server/src/cosmos/derive/blastRadius.ts
server/src/cosmos/derive/ownership.ts
server/src/cosmos/derive/health.ts
server/src/cosmos/derive/topicGroups.ts
server/src/cosmos/derive/drift.ts
server/src/cosmos/derive/playable.ts
server/src/cosmos/derive/__tests__/cosmosFixture.ts
server/src/cosmos/derive/__tests__/graph.test.ts
server/src/cosmos/derive/__tests__/blastRadius.test.ts
server/src/cosmos/derive/__tests__/ownership.test.ts
server/src/cosmos/derive/__tests__/health.test.ts
server/src/cosmos/derive/__tests__/drift.test.ts
server/src/cosmos/derive/__tests__/playable.test.ts
server/src/__tests__/cosmosParity.test.ts
scripts/cosmos-check.ts
docs/plans/server-owned-data-decisions.md

## Summary
Phase 3 is done. The server now computes every derived fact from its own data copy, and parity proves it matches the baseline. The client is untouched (its copies stay until Phase 8).
- **Derive modules** (`server/src/cosmos/derive/`), all pure functions that take the data as an argument:
  - `graph.ts`: logical edges (`{ key, type, from, to }`, no SVG path), `connectedNodeIds`, per-service `calls`/`publishes`/`consumes`/`domains` and per-topic `producers`/`consumers` (ported from `snapshot-map.ts`), and the shared `expandStepHops`.
  - `blastRadius.ts`: `deriveDependentsOf`, `dependentsOf(map, nodeId)`, `computeBlastRadius`, and the full map for every service and topic.
  - `ownership.ts`: `resolveOwner`, `ownerLabel`, `groupServicesByTeam`, `deriveOwnership`.
  - `health.ts`: `daysSinceCommit`, `statusFor`, `resolveHealth` (status + on-call + team label), plus counts per status.
  - `topicGroups.ts`: groups from `groupServiceId` (`{ id, serviceId, memberIds }`; ring geometry stays client-side).
  - `drift.ts`: latest run (`date`, `entries`, `byNode` with severity ranking), `driftSearchText`, `searchDrift(query)`, `driftPrUrl`, `driftCommitUrl`, `driftBranch`, `driftPrName`.
  - `playable.ts`: scenarios + incidents as one list, `stepsById`, `stepsFor(id)`, `isIncident`.
- **`view.ts`**: `getCosmosView()` returns `{ data, derived }`. It is built once, memoized and deep-frozen. `data` is the same object `getCosmosData()` returns. `deepFreeze` is now exported from `index.ts`.
- **Types**: `CosmosView`, `CosmosDerived` and every type they use were added to `apiTypes.ts`, which still has no imports.
- **Tests**:
  - `cosmosParity.test.ts` now checks every derived value against `baseline-full.json`: blast radius and 1-hop dependents for every service and topic, edges (without `d`), connected node ids, topic groups (without geometry), team groups, health per service plus counts, `LATEST_DRIFT_*`, `STEPS_BY_SCENARIO` and incident steps. It also checks per-service links and owner label, and per-topic producers/consumers, against `baseline-cosmos-map.json`. All pass with no fixture change.
  - New unit tests in `derive/__tests__/` run on a small fixture. They cover hop expansion, edge dedupe and sub-service skipping, dependency direction, the BFS levels, owner fallback and overrides, health thresholds, drift severity, every search facet, URLs, playable lookups, and view memoization and freezing.
- **cosmos:check phase 3** (3 checks): the derive modules and `view.ts` exist; derive modules import neither `data/` nor `index.ts`; the parity test has the derived block.
- Gates, all run in this stage on feature/add-ai with the changes uncommitted:
  - `npm run build`: ✅
  - `npm run typecheck`: ✅
  - `npm run lint`: ✅ 0 errors, 1 warning that was already there (Map.tsx:821 exhaustive-deps)
  - `npm test`: ✅ client 182/182 (no client file changed), server 297/297 (182 + 115 new across the parity block and the derive unit tests), scripts 5/5. The demo tour time-limit tests are included and pass.
  - `npm run validate`: ✅ 0 errors, 0 warnings, no drift
  - `npm run cosmos:check -- --phase 3`: ✅ 9/9. Phases 0 (3/3), 1 (5/5) and 2 (6/6) are also green.
  - `npm run parity:screens`: not run. No client file changed, so the screens cannot be affected.
- README: no update needed. The change is server-internal, with no new command, script, route or visible feature.

## Commit message
feat(server): derive blast radius, ownership, health, drift and playables on the server

Phase 3 of the server-owned data migration: getCosmosView() computes every derived fact once
from the server data copy, so agents and (later) the UI read the same answers. Parity against
the Phase 0/2 baseline proves each value matches the client's current output.

## Key decisions
(All of these are also in `docs/plans/server-owned-data-decisions.md`, in the new Phase 3 section.)
- **Derive functions take data as an argument.** Only `view.ts` calls `getCosmosData()`. This keeps them pure and easy to test, and a cosmos:check entry enforces it.
- **The split rule applied.** Edges drop the SVG `d` and topic groups drop `cx`/`cy`/`ringRadius`, because those are geometry. `*_META` presentation tables stay on the client. Locale formatting (`driftRunDateTime`), `driftEntriesByRun`, `activeNodeSet`/`shotNodeSet` and `radialMemberPosition` were not ported.
- **Drift search uses the kind id instead of the display label.** Each label lower-cased equals its kind id, and the search text is lower-cased, so matching is identical without moving `DRIFT_KIND_META` to the server.
- **Maps and sets became plain records and arrays**, so the view is JSON-ready for Phase 4.
- **`derived` adds three keys to the plan's Phase 4 list:** `serviceLinks`/`topicLinks` (the graph exposes them in the plan's table), `dependentsOf` and `driftLinks`.
- **Dependents are compared as sets.** The baseline lists 1-hop dependents in blast-radius order, while the server keeps graph insertion order.
- **No client unit tests existed for these helpers**, so there was nothing to port. New server unit tests were written instead.

## Open questions
- **Search cross-check not run.** I could not run a one-off `tsx` script that compares `searchDrift` and the URL builders against the client's `driftEntryMatches`/`driftPrUrl`/`driftCommitUrl` over every real drift entry, because the permission was denied. The script is ready at the scratchpad path `driftEquiv.ts` if you want to run it. Equivalence currently rests on the label/kind argument plus the facet unit tests.
- **Payload size for Phase 4.** `playable.stepsById` repeats steps that are already in `data.steps`/`data.incidents`. If the Phase 4 gzip measurement is close to 100 KB, drop `stepsById` from the payload and keep `stepsFor` as a function.
