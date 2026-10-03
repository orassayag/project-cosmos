# Stage 9 report — P9 (drift, health, demo data) + P10 (retarget every writer)

## Files
.claude/skills/add-scenario/SKILL.md
.claude/skills/add-service/SKILL.md
.claude/skills/update/SKILL.md
CLAUDE.md
CONTRIBUTING.md
README.md
client/src/App.tsx
client/src/__tests__/askMapActions.test.tsx
client/src/__tests__/fixtures/cosmos-response.json
client/src/api/cosmos-api.ts
client/src/demo/__tests__/demoMode.test.ts
client/src/demo/__tests__/demoTargets.test.tsx
client/src/demo/__tests__/scriptedAnswer.test.ts
client/src/demo/__tests__/scripts.test.ts
client/src/demo/scriptedAnswer.ts
client/src/demo/scripts.ts
client/src/demo/types.ts
client/src/map/Map.tsx
docs/plans/server-owned-data-decisions.md
drift-sync/README.md
drift-sync/scripts/__tests__/applyEditsPaths.test.ts
drift-sync/scripts/apply-edits.ts
drift-sync/scripts/bootstrap-state.ts
drift-sync/scripts/diff-repo.ts
drift-sync/scripts/lib/agent.ts
drift-sync/scripts/lib/cosmos-context.ts
drift-sync/scripts/lib/write-boundary.ts
drift-sync/scripts/sync-nightly.ts
drift-sync/scripts/sync.ts
drift-sync/scripts/validate.ts
package.json
scripts/cosmos-check.ts
scripts/fresh-start.mjs
server/src/__tests__/agentEval.test.ts
server/src/__tests__/demoData.test.ts
server/src/agent/systemPrompt.ts
server/src/cosmos/apiTypes.ts
server/src/cosmos/data/demo.ts
server/src/cosmos/data/drift.ts
server/src/cosmos/data/health.ts
server/src/cosmos/data/incidents/index.ts
server/src/cosmos/data/steps/index.ts
server/src/cosmos/index.ts
server/src/cosmos/schema.ts
server/src/cosmos/validate.ts
skills/add-scenario/SKILL.md
skills/add-service/SKILL.md

## Summary
Phase 9: drift and health now carry `source: 'fixture'`. The system prompt says they are AstroMart demo data. New `data.demo` (`server/src/cosmos/data/demo.ts`) holds both tours, and `client/src/demo/` builds them from the response, with no AstroMart ids left in it. The `demo=ai` answer opens the `shipping` passport beside the answer on desktop only, so phones are unchanged. `demoData.test.ts` plus an `agentEval` case guard the scripted answer against stale drift.

Phase 10: every Drift Sync reader and `npm run validate` read `getCosmosData()` / `validateCosmos()`. The applier's `write_file` is now limited to `server/src/cosmos/data/`, with a new test. `npm run fresh` writes a starter cosmos into the server data. Copy coords output, skills (plus synced plugin copies) and docs point at the server paths.

Over the sizing ceiling: 47 files, against the 10-file limit. Two phases with a long fixed writer list made this unavoidable; most edits are small.

Gates run (all on this working tree):
- `npm run build`: ✅, `COSMOS_VERSION=4834125e5b267bcd`. Client JS is 609,220 B raw / 199,420 B gzip, and no AstroMart data strings are left in the bundle.
- `npm run typecheck`: ✅.
- `npm exec -- tsc -p drift-sync --noEmit` (the CI step): ✅.
- `npm run lint`: ✅ 0 errors. The 1 warning is the existing one at `Map.tsx:834`.
- `npm test`: ✅ client 215, server 342, scripts 10.
- `npm run validate`: ✅ 0 errors, 0 warnings.
- `npm run cosmos:check -- --phase 10`: ✅ 33/33.
- `npm run test:e2e`: ✅ 4/4 with `BASE_URL=http://localhost:5175`, because 5173/5174 are held by an unrelated Vite.
- `npm run parity:screens`: ✅ 16/16, 0 px.
- `npm run record:demo` on :5175: ✅ `ai` 28.0s (limit 60s), `all` 117.6s (limit 120s).
- `npm run fresh`: ✅ run in a scratch copy outside the repo. `validate` passed, the client build passed, and `npm run dev` rendered the 2-planet starter with no page errors.

Not run, because they are outward-facing: the Drift Sync `workflow_dispatch` dry run and re-enabling `DRIFT_SYNC_ENABLED` (commands under Open questions).

## Commit message
feat(cosmos): serve demo tour data and retarget every writer to server data

The demo tours, Drift Sync, validate, fresh-start, layout export and skills
still read or wrote the old client copy. They now read server/src/cosmos/data,
and the applier can only write there, so Phase 11 can delete the copy.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

## Key decisions
- **`data.demo` has extra fields.** Besides the plan's fields it carries `allTour.browseDomainId`, `aiTour.domainId`, `aiTour.passportNodeId` and `aiTour.citedDriftEntryIds`, each replacing an id the demo hard-coded. `allTour.incidentId` is explicit (`hub-silence-2026-07-19`) and nullable: `null` skips the incident replay, for the starter cosmos. `DEMO_TARGETS` dropped the domain ids in favour of `domain-${string}`.
- **The `demo=ai` map action is `openPassport` on desktop only.** It fires together with the highlight when the answer starts typing. On phones any action surface would cover the answer (one panel at a time), so it is left out there. This was checked with screenshots at 1440×900 and 390×844.
- **The demo id check is in `validateCosmos()`; the staleness rule is test-only.** `unknown-demo-reference` runs in validation. The 24h rule lives only in `demoData.test.ts`, so a future drift producer moving `asOf` forces a deliberate answer rewrite without blocking validation.
- **The applier's write boundary is now enforced.** It covers `server/src/cosmos/data/` only, through `drift-sync/scripts/lib/write-boundary.ts`. Before this, `write_file` only checked the repo root. `cosmos-confirmed.json` and the snapshot are off the applier surface, and the applier no longer runs `npm run snapshot`.
- **`npm run validate` keeps the legacy snapshot freshness check until Phase 11.** The internal checks are now `validateCosmos()`.
- **Data barrels for `npm run fresh`.** `server/src/cosmos/index.ts` reads the `data/steps/index.ts` and `data/incidents/index.ts` barrels so `fresh` can swap those files. `fresh` also narrows `TeamId` and `TeamIdSchema` to `team-core` and runs `types:emit`.
- **`parity-screens.mjs` keeps its self-hosted preview.** It serves the exact `/api/cosmos` body, which keeps it deterministic. `record-demo.mjs` already defaulted to `:5173`.
- **The phase-10 A3 grep covers writers and readers only.** That is drift-sync, scripts, server/scripts, e2e, skills and `.github`. It excludes `cosmos-check.ts`, `snapshot-map.ts` (Phase 11) and the boundary test. The unscoped plan grep still hits the old client copies, parity tests, `snapshot-map.ts`, `cosmosMapSnapshot.ts` (Phase 11), and the snapshot lines in `CLAUDE.md`/README (Phase 12).
- **Docs got minimal path fixes; the full pass is Phase 12.** README, `drift-sync/README.md`, `CONTRIBUTING.md` and `CLAUDE.md` (merged, not overwritten) now point data edits at the server copy.
- **Unrelated flaky test fixed.** `askMapActions.test.tsx` failed under full-suite load, and also failed with the pre-change `App.tsx`. The helper now flushes effects with `await act(async () => {})`, and the full suite then passed 6 runs out of 6.
- **For Phase 11:** nothing at runtime reads `client/src/scenarios` or `client/src/incidents` any more. Only the client parity twin and `server/scripts/snapshot-map.ts` (and so `validate`'s freshness check) still do.

## Open questions
1. **The first real Drift Sync data edit will fail CI.** `server/src/__tests__/cosmosParity.test.ts` deep-compares the server data with the frozen `baseline-full.json`, and `npm test` runs in CI on every PR. Should Drift Sync PRs update that fixture, or should the parity test be retired once Phase 11 lands? Phase 11 keeps it "until a deliberate data change updates it".
2. **After `npm run fresh`, `npm run build` fails.** The server `tsc -p .` covers AstroMart-specific tests that name `team-shopping` and others, and the parity tests fail too. `npm run dev` works. Phase 12 (forks) should decide: `fresh` could also remove or skip the AstroMart-only tests, or those tests could read ids from the data.
3. **Outward-facing steps for the owner,** after pushing this branch. The job's `if: vars.DRIFT_SYNC_ENABLED == 'true'` also gates manual dispatch. Use `mode=live` to see the edit, validation and draft PR; leave the variable `true` afterwards, which is I5. Record the result in the decisions log.
   ```bash
   git push origin feature/add-ai
   gh variable set DRIFT_SYNC_ENABLED --body true
   gh workflow run cosmos-sync.yml --ref feature/add-ai -f mode=live
   gh run watch
   gh pr list --search "head:drift-sync" --state open
   ```
