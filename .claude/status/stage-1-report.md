# Stage 1 report — P0: Baseline and parity oracle

## Files
.gitignore
package.json
package-lock.json
scripts/dump-baseline.ts
scripts/parity-screens.mjs
scripts/cosmos-check.ts
scripts/__tests__/cosmosCheck.test.ts
docs/plans/server-owned-data-decisions.md
server/src/__tests__/fixtures/baseline-full.json
server/src/__tests__/fixtures/baseline-cosmos-map.json
docs/plans/baseline-screens/*.png

The PNG glob covers 16 files: default-map, mobile-default-map, 5 `scenario-*`, 3 `incident-*`, blast-payments,
health-view, ownership-view, drift-overlay, changelog-open and realtime-hub-selected.

## Summary

Phase 0 is complete, and the owner's feedback has been applied. No product code changed:
`git diff -- client/ server/src drift-sync` is empty apart from the new fixtures.

**Feedback applied**

- **TypeScript pinned to `^6.0.3`.** The root `package.json` is the only one that declares `typescript`.
  - `package-lock.json` was regenerated with a plain `npm install`, with no `--legacy-peer-deps`.
  - The lock diff drops the TypeScript 7 packages and adds `pixelmatch` and `pngjs`.
  - `npm ci` now succeeds with no ERESOLVE.
  - After `npm ci`, `node_modules/typescript` is 6.0.3, and `npm ls typescript` shows one deduped 6.0.3. The earlier `--no-save` workaround is no longer in play.
- **Decisions log updated** with:
  - the TypeScript pin, its reason (typescript-eslint 8.71 supports TypeScript below 6.1; CI on `main` has been red since `a86f10b`), and a note to revisit when typescript-eslint supports TypeScript 7
  - the owner's acceptance of fallback fonts in the parity baselines
- **Unverified: the `scripts/*.ts` type-check.** The no-emit `npx tsc --noEmit … scripts/*.ts` check was denied permission again. The new `scripts/*.ts` files are still not type-checked. They do run under `tsx` and pass lint. No tsconfig was added.

**Gates, all run after `npm ci` on the pinned install**

| Gate | Result |
| --- | --- |
| `npm ci` | ✅ clean, no `--legacy-peer-deps` |
| `npm run build` | ✅ |
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ 0 errors, 1 warning that was already there (`client/src/map/Map.tsx:814`) |
| `npm test` | ✅ client 140/140, server 103/103, scripts 5/5 |
| `npm run validate` | ✅ 0 errors, 0 warnings |
| `npm run cosmos:check -- --phase 0` | ✅ 3/3 |
| `npm run parity:screens` | ✅ 16/16 within 0.1%. The worst view was 29 px (0.0014%). |

The preview server on port 4317 is stopped; nothing is listening.

**Stage work from before this feedback**

- **Baseline gates** ran on `feature/add-ai` at `0dc2b6e`, not on `main`, because this stage cannot switch branches. This is recorded in the decisions log.
- **Drift Sync:** `DRIFT_SYNC_ENABLED` did not exist before, so the workflow was already off.
  - It is now set to `false`.
  - There were no open Drift Sync PRs, and no open PRs at all.
- **`npm run baseline:dump`** writes `baseline-full.json`, which holds all the data plus the derived values. It also copies the snapshot to `baseline-cosmos-map.json`. Running it again gives the same file.
- **`npm run parity:screens` (A2):**
  - It captures 16 deterministic views and writes diffs to `parity-out/`, which is gitignored.
  - Determinism: two runs after `--update` both passed.
  - A 20 px nudge to payments `x` failed `default-map` and `health-view`, and the command exited 1. The nudge was reverted.
- **`npm run cosmos:check` (A3)** passes at `--phase 0`. It has an extensible table of checks with a phase per check. Its unit tests run under `npm run test:scripts`, which is now part of `npm test`.
- **Bundle and first paint** were recorded in the decisions log: JS 213 KB gzip, median first contentful paint 336 ms.

## Commit message
chore(parity): add Phase 0 baseline oracle and pin TypeScript to ^6.0.3

Every later migration phase needs a frozen record of today's data, derived facts and visuals to prove the map is unchanged; adds baseline:dump, parity:screens and cosmos:check plus the decisions log.
TypeScript goes back to ^6.0.3 because typescript-eslint 8.71 rejects TS 7, which broke npm ci and lint (CI red since a86f10b); revisit when typescript-eslint supports TS 7.

## Key decisions
- **TypeScript is pinned to `^6.0.3`** (owner decision), with the lockfile regenerated honestly. Revisit when typescript-eslint supports TypeScript 7.
- **The parity baselines use fallback fonts** (owner decision). Google Fonts are blocked during capture because their load timing raced the first camera fit and made the shots flaky.
- **Gates ran on the branch, not `main`.** The stage cannot switch branches.
- **The screenshots are made deterministic** by:
  - freezing the clock
  - seeding `Math.random`
  - turning off CSS transitions and animations
  - stubbing `/api` with a 404
  - masking the version badge
- **Mid-play is reached by pressing Next.** The `?step=N` deep link always lands on step 1. That bug is logged, not fixed.
- **`realtime-hub` expanded was replaced with `realtime-hub-selected`.** `expandedServiceId` is a hard-coded `null` (`client/src/map/Map.tsx:174`), so the expanded state can't be reached in the UI.
- **DEPENDENTS_OF is rebuilt from `computeBlastRadius` 1-hop results.** It is module-private, and exporting it would be a product change.
- **The threshold stays at 0.1%,** confirmed by the repeat runs and the nudge test.

## Open questions
- **Phase 10:** re-enable Drift Sync by setting `DRIFT_SYNC_ENABLED` to `true`. The variable did not exist before this stage.
- **Unverified:** a no-emit type-check of `scripts/*.ts` was denied permission. The owner may want a covering tsconfig in a later phase.
