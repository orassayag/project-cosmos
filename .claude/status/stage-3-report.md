## Files
package.json
package-lock.json
eslint.config.mjs
server/package.json
server/tsconfig.json
server/scripts/tsconfig.json
server/scripts/snapshot-map.ts
server/src/generated/cosmos-map.json
drift-sync/scripts/validate.ts
drift-sync/scripts/apply-edits.ts
drift-sync/scripts/sync-nightly.ts

## Summary
Added the `server/` workspace skeleton (`@project-cosmos/server`, ESM) with its own `build`, `typecheck` and `snapshot` scripts. There is no runtime code and there are no new dependencies. `server/scripts/snapshot-map.ts` builds a compact, deterministic JSON snapshot of the map from the same `client/src/scenarios/data.ts` barrel the app uses, plus `owners.ts`. It does not import `runner.ts`. It writes the snapshot to `server/src/generated/cosmos-map.json` (41.6 KB, one line plus a trailing newline).

The snapshot contains:
- **domains**
- **teams**
- **services**: id, name, role, sub, desc, lang, tech, repo, team, ownerLabel, domains, calls, publishes, consumes, subServices
- **topics**: with producers and consumers
- **scenarios**: id, domain, title, status, short, phaseId, ordered steps
- **incidents**: id, domain, title, date, time, note, steps

Each step has from, to, via, through, type, parallel, label, title and plain. Layout and colour fields and payloads are left out.

Root changes:
- `workspaces` is now `["client","server"]`.
- New root script `snapshot` runs `npm run snapshot --workspace server`.
- `validate` is still the root tsx script.

`validate.ts` gained the `stale-snapshot` check. It rebuilds the snapshot in memory and fails when it does not match the committed file, including when the file is missing. The message is exactly `cosmos-map.json is stale — run npm run snapshot`.

`apply-edits.ts` changes:
- It runs `npm run snapshot` after the agent finishes and before it captures the diff and does the dry-run revert.
- The snapshot path is added to `WRITABLE_PATHS`.
- The agent may now run `npm run snapshot`, and the prompt tells it to run it before `npm run validate`.

`sync-nightly.ts` has the same `WRITABLE_PATHS` addition. ESLint's Node-globals block now also covers `server/**/*.ts`.

Verification (run for real):
- `npm install`: ok. The lockfile gained the server workspace entry.
- `npm run build`: exit 0. This includes the server's two `tsc --noEmit` passes.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, with 0 errors and 2 warnings. Both warnings are react-hooks `exhaustive-deps` in `client/src/components/AskPanel.tsx` and `client/src/map/Map.tsx`, both files outside this stage's scope.
- `npm run validate`: exit 0, "No drift detected".
- Stale check proven live:
  - A hand-edited `cosmos-map.json` makes validate exit 1 with the exact message.
  - A deleted snapshot makes validate exit 1 with the same message and `missing: true`.
  - Editing a scenario label in `client/src/scenarios/scenarios.ts` without re-snapshotting makes validate exit 1 with the same message.
  - After each case I restored or regenerated the file, and validate exits 0 again.
- Determinism: two `npm run snapshot` runs gave the same sha1 (`ae2f4cf9…`). A snapshot regenerated after deletion was byte-identical to the backup (`cmp`).

**Not run:**
- `npx tsc -p drift-sync --noEmit` was denied by permissions again, so drift-sync's type-check of the new `validate.ts` → `server/scripts/snapshot-map.ts` import is unverified. The risk is low because `server/scripts/tsconfig.json` checks the same file under the same Bundler resolution and it passes. Stage 5 still has to run it.
- I could not confirm directly that ESLint lints `server/` files, because `npx eslint <file>` was denied. `eslint .` has no ignore rule matching `server/`, so it should be covered.

## Commit message
feat(server): add server workspace skeleton and committed cosmos-map snapshot

The upcoming AI server must not reach into client/ at runtime, so it reads a
committed JSON snapshot of the map data. validate fails when the snapshot is
stale, and apply-edits and the nightly pipeline regenerate it and include it in their PRs.

## Key decisions
- **Two server tsconfigs.** `server/tsconfig.json` uses NodeNext as the plan requires. `server/scripts/tsconfig.json` extends it but uses Bundler resolution. The snapshot script imports client source, whose relative imports have no file extensions, and NodeNext rejects those with TS2835 in every client file (I reproduced this). The scripts are tsx-only tooling and are never deployed, so the NodeNext `.js` rule still applies to everything under `server/src`. `build` and `typecheck` run both configs. The root config includes `src/**/*.json`, so it has an input even before any `.ts` source exists and does not fail with TS18003.
- **Filename kept as `snapshot-map.ts`** (kebab-case), not camelCase. The plan and later stages use that name, and it matches the existing kebab-case `drift-sync/scripts/*` files.
- **`sync-nightly.ts` does need the path.** Its `WRITABLE_PATHS` is used by `resetWritableSurface` (checkout and clean), by the dirty-surface pre-check, by the revert paths, and by `git add` for the team PR commit. Without the path, the regenerated snapshot would be left out of the drift PR, and that PR's `validate` would fail as stale. It would also not be reset between teams.
- **In-loop validate in the applier.** Once the agent edits the data, validate fails until the snapshot is regenerated, so the agent is now allowed to run `npm run snapshot`. The script also regenerates the snapshot after the agent finishes, as the plan requires. A failure there is logged and does not throw, matching the surrounding diff-capture error handling.
- **Snapshot scope.** Services' `calls`, `publishes`, `consumes` and `domains`, and topics' `producers` and `consumers`, come from the live scenario `STEPS` only, not from incident steps. For a kafka step, the consumer is `through ?? to`, matching validate's rule. Lists are sorted and array order follows the source, so the output is deterministic.
- **Snapshot == what the app shows.** It uses the `data.ts` barrel, so the orphaned `steps/core.ts` (`CORE_STEPS`, which is not in the barrel) is not in the snapshot. That is a pre-existing issue and I left it alone.

## Open questions
- Sizing ceiling: this stage touches 9 non-exempt files, against `MASTER_MAX_FILES_PER_STAGE`=6. The extra file on top of the brief's list is `server/scripts/tsconfig.json`, which is needed for the NodeNext/Bundler split above. The stage plan had already marked this stage as impossible to split further.
- `npx tsc -p drift-sync --noEmit` is still not run because permission was denied. It carries over to the stage 5 gate.
- The snapshot is compact single-line JSON, as the plan specifies, so any drift PR diff on it is one huge line. If you want reviewable diffs, switching to 2-space indentation is a one-line change in `serializeCosmosMap`.
