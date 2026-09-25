# Master Run Ledger
Plan: docs/plans/add-ai.md

## Stage 1 — M0: move Vite app into client/ workspace (committed 2026-09-25T21:18:00Z)
**Files:** 86 `git mv` renames (index.html, public/, src/**, tsconfig.json, vite.config.ts → client/), package.json, package-lock.json, client/package.json, eslint.config.mjs, .gitignore
**What was built:** Root package.json is now an npm workspaces root (`["client"]`) with orchestration scripts + shared tooling only; React/Vite deps live in `client/package.json` (`@project-cosmos/client`). `client/vite.config.ts` resolves the versions ledger via `fileURLToPath(new URL('../versions/', import.meta.url))` (cwd-independent). eslint targets `client/src` and ignores `**/dist/`; .gitignore adds client/dist/, server/dist/, **/tsconfig.tsbuildinfo. build/lint/typecheck pass.
**Key decisions:** `dev` and `dev:client` both run the client workspace until stage 6 swaps `dev` to `vercel dev`. `build`/`typecheck` fan out with `--workspaces` and no `--if-present` — stage 3 MUST give `server` its own `build` + `typecheck` scripts. Lint stays a single root `eslint .`. `validate`, `sync*`, `fresh` scripts unchanged at root. vercel.json untouched until stage 6.
**Known broken until stage 2:** `npm run validate` fails (drift-sync imports `../../src/...`); `scripts/fresh-start.mjs` still resolves `<root>/src/scenarios/`; `npx tsc -p drift-sync --noEmit` baseline was not captured (permission denied) — stage 2 should capture it.
**User overrides during review:** none.

## Stage 2 — M0: repoint drift-sync + fresh-start to client/src (committed 2026-09-26T00:00:00Z)
**Files:** drift-sync/README.md, drift-sync/scripts/{apply-edits,bootstrap-state,diff-repo,sync-nightly,sync,validate}.ts, drift-sync/scripts/lib/{agent,cosmos-context}.ts, drift-sync/tsconfig.json, scripts/fresh-start.mjs
**What was built:** Every root-relative `src/…` consumer outside the client now points at `client/src/…` (imports, prompts, tool descriptions, README). `WRITABLE_PATHS` is `client/src/scenarios/` in **both** apply-edits.ts:87 and sync-nightly.ts:213. drift-sync/tsconfig.json extends `../client/tsconfig.json` (root tsconfig no longer exists). `npm run validate`, build, lint pass; a deliberate bad id makes validate exit 1.
**Key decisions:** No new root tsconfig — drift-sync inherits client's compiler options (incl. `vite/client` types + DOM libs). `sync.ts` `repoRoot = path.resolve(here,'..')` → `drift-sync/` is pre-existing and unrelated; left alone.
**Still open:** `npx tsc -p drift-sync --noEmit` NOT run (permission denied) — stage 5 gate must run it. Plan's `npm run sync -- --dry-run` does not exist; the real credential-free check is `npm run sync:bootstrap -- --dry-run` — stage 5 should use that. Pre-existing: `client/src/scenarios/steps/core.ts` (`CORE_STEPS`) is not in the `data.ts` barrel, so validate never sees its steps — out of scope, untouched.
**User overrides during review:** none.
