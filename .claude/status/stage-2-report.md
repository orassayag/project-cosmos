# Stage 2 report — M0: repoint drift-sync + fresh-start to client/src

## Files
drift-sync/README.md
drift-sync/scripts/apply-edits.ts
drift-sync/scripts/bootstrap-state.ts
drift-sync/scripts/diff-repo.ts
drift-sync/scripts/lib/agent.ts
drift-sync/scripts/lib/cosmos-context.ts
drift-sync/scripts/sync-nightly.ts
drift-sync/scripts/sync.ts
drift-sync/scripts/validate.ts
drift-sync/tsconfig.json
scripts/fresh-start.mjs

## Summary
Repointed every `src/scenarios` consumer outside the client to `client/src/scenarios`. All changes are path strings only (48 lines changed in 11 files).
- Imports: `../../src/…` became `../../client/src/…` in sync.ts, sync-nightly.ts, validate.ts and bootstrap-state.ts. `../../../src/…` became `../../../client/src/…` in lib/cosmos-context.ts.
- `WRITABLE_PATHS` became `client/src/scenarios/` in **both** apply-edits.ts:87 and sync-nightly.ts:213. The plan named only the first one; the sweep found the second.
- Prompt and tool strings: the apply-edits.ts system prompt (file list, forbidden-paths line `Any file under client/src/`, the `<repo-name>/client/src/…` footgun example, and the JSON example). Also the example path in the sync.ts proposal JSON, the diff-repo.ts prompt example, and the lib/agent.ts `write_file` tool description plus its footgun comment.
- drift-sync/README.md: 5 path mentions.
- drift-sync/tsconfig.json: `extends` was `../tsconfig.json`, which no longer exists since stage 1 moved it to `client/`. It is now `../client/tsconfig.json`. `include: ["scripts"]` is unchanged, because tsc follows the imports into `client/src/scenarios`.
- scripts/fresh-start.mjs: lines 8, 16 (`resolve(root, 'client/src/scenarios', p)`) and 180. Checked by reading and grep only; **not run**.
- A final sweep with `grep src` over drift-sync/ and fresh-start.mjs finds no root-relative `src/` left. There are no `path.join(root,'src',…)` calls or globs.

Verification:
- `npm run validate` — **PASS**: 12 services, 8 topics, 40 steps, 5 scenarios, 0 errors. Stage 1's ERR_MODULE_NOT_FOUND is fixed.
- Live-validate check — **PASS**: changed the first `from` in `client/src/scenarios/steps/shopping.ts` to `bogus-svc`. validate exited 1 with `step.from "bogus-svc" is not a known service or topic`. The file was restored from backup, and `git status` shows it clean.
- `npm run build` — **PASS**. The only warning is the existing chunk-size notice.
- `npm run lint` — **PASS**: 0 errors, 2 existing react-hooks warnings in Map.tsx.
- `npx tsc -p drift-sync --noEmit` — **NOT RUN**. The permission system denied it, and also denied `./node_modules/.bin/tsc -p drift-sync/tsconfig.json --noEmit`. Indirect evidence that it would pass: tsx resolves every repointed import at runtime (validate and bootstrap both ran), and the extends target exists. The orchestrator or a human should run it.
- `npm run sync -- --dry-run` — **cannot run as written**. `sync.ts` has no `--dry-run` flag. Its only mode is `investigate-topic <id>`, which needs `ANTHROPIC_API_KEY` and the network. I ran the credential-free equivalent instead, `npm run sync:bootstrap -- --dry-run`. It loaded the map through the new imports, derived all 15 repos, and reported every one as MISS because there are no sibling clones on this machine. It wrote no state file. The imports resolve end to end.

## Commit message
refactor(drift-sync): repoint map paths to client/src after workspace move

Stage 1 moved the Vite app into client/, which broke drift-sync's imports,
its writable-path sandbox, the agent prompts and fresh-start. Repointing them
brings `npm run validate` back and keeps the nightly applier writing to the real map files.

## Key decisions
- sync-nightly.ts has its own `WRITABLE_PATHS` (line 213), separate from the one in apply-edits.ts. I updated it too. If I hadn't, the nightly guard would reject every legitimate map edit.
- drift-sync/tsconfig.json now extends `../client/tsconfig.json` rather than adding a new root tsconfig. That keeps compiler options in one place. It also pulls in the client's `types: ["vite/client"]` and DOM libs, which was already true before the move.
- `sync.ts` builds `repoRoot = path.resolve(here, '..')`, which resolves to `drift-sync/`. This predates the move and has nothing to do with `src/`, so I left it alone.

## Open questions
- Someone needs to run `npx tsc -p drift-sync --noEmit`, since the permission system denied it here. Stage 5's full gate should cover it.
- The plan's verification line says `npm run sync -- --dry-run`, but that flag doesn't exist on `sync.ts`. `sync:bootstrap -- --dry-run` (used above) or `sync:nightly` (needs a key) are the real candidates. The plan or stage 5 gate text should be corrected.
- A pre-existing, out-of-scope finding: `client/src/scenarios/steps/core.ts` (`CORE_STEPS`) is not imported by the `data.ts` barrel. validate and the app never see its steps, so a bad id there goes unnoticed. My first corruption test hit this file and returned 0 errors. I did not change it.
