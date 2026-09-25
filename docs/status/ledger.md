# Master Run Ledger
Plan: docs/plans/add-ai.md

## Stage 1 — M0: move Vite app into client/ workspace (committed 2026-09-25T21:18:00Z)
**Files:** 86 `git mv` renames (index.html, public/, src/**, tsconfig.json, vite.config.ts → client/), package.json, package-lock.json, client/package.json, eslint.config.mjs, .gitignore
**What was built:** Root package.json is now an npm workspaces root (`["client"]`) with orchestration scripts + shared tooling only; React/Vite deps live in `client/package.json` (`@project-cosmos/client`). `client/vite.config.ts` resolves the versions ledger via `fileURLToPath(new URL('../versions/', import.meta.url))` (cwd-independent). eslint targets `client/src` and ignores `**/dist/`; .gitignore adds client/dist/, server/dist/, **/tsconfig.tsbuildinfo. build/lint/typecheck pass.
**Key decisions:** `dev` and `dev:client` both run the client workspace until stage 6 swaps `dev` to `vercel dev`. `build`/`typecheck` fan out with `--workspaces` and no `--if-present` — stage 3 MUST give `server` its own `build` + `typecheck` scripts. Lint stays a single root `eslint .`. `validate`, `sync*`, `fresh` scripts unchanged at root. vercel.json untouched until stage 6.
**Known broken until stage 2:** `npm run validate` fails (drift-sync imports `../../src/...`); `scripts/fresh-start.mjs` still resolves `<root>/src/scenarios/`; `npx tsc -p drift-sync --noEmit` baseline was not captured (permission denied) — stage 2 should capture it.
**User overrides during review:** none.
