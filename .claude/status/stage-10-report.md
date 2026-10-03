# Stage 10 report — P11 (delete old sources) + P12 (docs, live data in dev, forks)

## Files
CLAUDE.md
CONTRIBUTING.md
README.md
client/src/__tests__/cosmosParity.test.ts
client/src/__tests__/noDevPollingInProd.test.ts
client/src/__tests__/paletteTokens.test.ts
client/src/api/__tests__/devPolling.test.ts
client/src/api/cosmosClient.ts
client/src/api/useCosmosLoad.ts
client/src/incidents/data.ts
client/src/incidents/hub-silence-2026-07-19.ts
client/src/incidents/inventory-oversell-2026-05-04.ts
client/src/incidents/payment-cascade-2026-03-12.ts
client/src/incidents/types.ts
client/src/scenarios/brand.ts
client/src/scenarios/clusters.ts
client/src/scenarios/data.ts
client/src/scenarios/drift.ts
client/src/scenarios/health.ts
client/src/scenarios/owners.ts
client/src/scenarios/palette.ts
client/src/scenarios/scenarios.ts
client/src/scenarios/services.ts
client/src/scenarios/steps/core.ts
client/src/scenarios/steps/engagement.ts
client/src/scenarios/steps/fulfillment.ts
client/src/scenarios/steps/shopping.ts
client/src/scenarios/topics.ts
client/src/scenarios/types.ts
docs/plans/server-owned-data-decisions.md
docs/plans/server-owned-data.md
docs/plans/single-source-data.plan.md
drift-sync/README.md
drift-sync/scripts/__tests__/applyEditsPaths.test.ts
drift-sync/scripts/validate.ts
package.json
scripts/__tests__/cosmosCheck.test.ts
scripts/cosmos-check.ts
server/package.json
server/scripts/snapshot-map.ts
server/src/__tests__/cosmosMap.test.ts
server/src/__tests__/cosmosParity.test.ts
server/src/__tests__/fixtures/baseline-agent-snapshot.json
server/src/__tests__/fixtures/baseline-cosmos-map.json
server/src/agent/__tests__/context.test.ts
server/src/agent/classify.ts
server/src/agent/context.ts
server/src/agent/localRelevance.ts
server/src/agent/mapSnapshot.ts
server/src/agent/route.ts
server/src/agent/types/cosmosMapSnapshot.ts
server/src/generated/cosmos-map.json

## Summary
Phase 11: the frozen client data (`client/src/scenarios/`, `client/src/incidents/`), `server/src/generated/cosmos-map.json`, `server/scripts/snapshot-map.ts`, the `snapshot` scripts (root and server), `validate`'s `stale-snapshot` check, and the client parity twin are deleted. The agent snapshot types from `server/src/agent/types/cosmosMapSnapshot.ts` moved unchanged into `server/src/agent/mapSnapshot.ts`, with 4 imports repointed. The frozen fixture `baseline-cosmos-map.json` was renamed `baseline-agent-snapshot.json`, content unchanged. The server parity test stays. The twin's tokens.css palette check survives as `client/src/__tests__/paletteTokens.test.ts`. No client helper had zero importers, so none was deleted. `cosmos:check` gained a `files-absent` check type (unit-tested) and the phase 11 checks.

Phase 12: dev-only live data. `startDevCosmosPolling` / `fetchCosmosIfChanged` in `client/src/api/cosmosClient.ts` poll `/api/cosmos` every 2s with `If-None-Match` and `cache: 'no-store'`, guarded by `import.meta.env.DEV`. `useCosmosLoad` swaps a new version into the ready state, and so into `CosmosProvider`. New tests: `devPolling.test.ts` (200 with a new version updates the provider, 304 does not, nothing outside dev) and `noDevPollingInProd.test.ts` (an in-process production `vite build` has no `If-None-Match` / `no-store`). `tsx watch` already follows the data files, so the watch list is unchanged. Docs: README (principle #1, quickstart, scripts, fork quickstart, layout, deployment, tech notes, testing), `CLAUDE.md` (merged), `CONTRIBUTING.md`, `drift-sync/README.md`, the new decision record `docs/plans/server-owned-data.md`, the single-source plan marked superseded, and the decisions log. The phase 12 checks were added.

Over the sizing ceilings: 53 paths, against the 10-file limit. 23 of them are deletions, and most edits are small. `scripts/cosmos-check.ts` is 483 lines, against the 400-line limit, because it is an append-only check table.

Gates (all on this working tree):
- `npm run build`: ✅, `COSMOS_VERSION=4834125e5b267bcd` (unchanged: no data change).
- `npm run typecheck`: ✅.
- `tsc -p drift-sync --noEmit`: ✅.
- `npm run lint`: ✅ 0 errors. The 1 warning is the existing one at `Map.tsx:834`.
- `npm test`: ✅ client 194, server 342, scripts 11. The client count fell from 215 because the parity twin's `it.each` cases went.
- `npm run validate`: ✅ 0 errors, 0 warnings.
- `npm run cosmos:check` (all phases): ✅ 43/43.
- `npm run test:e2e`: ✅ 4/4 with `BASE_URL=http://localhost:5175`, because 5173/5174 are held by an unrelated Vite.
- `npm run parity:screens`: ✅ 16/16, 0 px.
- `npm run record:demo` on :5175: ✅ `ai` 27.6s (limit 60s), `all` 117.6s (limit 120s).
- Live edit acceptance: with the dev stack on :5175/:8787, renaming the `payments` capsule label in `server/src/cosmos/data/services.ts` showed on the open map in 1,884 ms with 0 page errors. The file was restored byte-for-byte afterwards.
- `npm run fresh` in a scratch copy outside the repo: `fresh` itself succeeds, and the client suite passes 194/194. The server type-check fails in 4 derive test files, and 126 of 290 server tests fail. See Open questions.

## Commit message
feat(cosmos): delete the client data copy and poll live data in dev

The server now owns the map outright: the frozen client copy, the cosmos-map
snapshot and its tooling are gone, and docs describe the server-owned model.
In dev the client polls /api/cosmos so a data edit reaches the open map.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

## Key decisions
- **The agent snapshot types moved, not deleted.** `CosmosMapSnapshot` / `Snapshot*` are still the agent's working shape, so they moved into `mapSnapshot.ts` and kept their names to keep the diff small.
- **The fixture rename keeps the "no `cosmos-map` outside `docs/`" rule exception-free.** The `cosmos-map` grep excludes only `docs/`, `versions/` (generated), `.claude/status/` and `cosmos-check.ts`.
- **The palette-token invariant got its own test.** The deleted twin was its only guard, so `paletteTokens.test.ts` now reads the keys from the response fixture.
- **The dev polling guard also skips `MODE === 'test'`.** That keeps the existing App tests deterministic; `devPolling.test.ts` opts in by stubbing `DEV` and `MODE`. A failed poll is ignored and retried on the next tick, because the dev server is briefly down after every data edit.
- **The poll uses `cache: 'no-store'`.** The route's `max-age=60` would otherwise let the browser answer from its cache for up to a minute.
- **The prod-bundle test sets `NODE_ENV=production` during the in-process build.** Vitest sets it to `test`, which made Vite keep `DEV` true; this was confirmed by a first failing run.
- **knip could not run** (the package download was denied). A script found no unimported client file except `vitestSetup.ts`, which the Vitest config loads.
- **Both stage-9 carry-overs were decided conservatively,** and recorded in `docs/plans/server-owned-data-decisions.md`. The parity test is kept, and the docs say how a deliberate data change updates it. The fresh-then-build gap is documented in the README fork quickstart, not fixed.

## Open questions
1. **Drift Sync PRs will fail CI.** On any real data edit, two tests fail: `server/src/__tests__/cosmosParity.test.ts`, which compares against the frozen `baseline-full.json`, and the client fixture freshness test. The applier updates neither, and the docs now tell humans to update both in the same PR. Should the applier run `npm run fixture:cosmos` and update `baseline-full.json`, or should the server parity test be retired now that the migration is done?
2. **After `npm run fresh`, `npm run build` and the server tests fail.** The derive tests' synthetic fixture names AstroMart team ids; parity, agentEval, demoData and others assume AstroMart. That is 126 of 290 server tests. Should `fresh` delete the AstroMart-only server suites, or should those suites be rewritten to read ids from the data? The README currently states the gap.
3. **Outward-facing steps, unchanged from stage 9 and not done here:** re-enabling `DRIFT_SYNC_ENABLED` and the `workflow_dispatch` dry run.
