# Stage 1 work brief — M0: move the Vite app into `client/` + npm workspaces root

Plan: `docs/plans/add-ai.md` (§1 — Milestone 0). No spec file for this run.

## This stage's scope (and only this)

1. **`git mv` the Vite app into `client/`** — `index.html`, `vite.config.ts`, `tsconfig.json`
   (the app's), `public/`, `src/`. Use `git mv` for every move so history follows the files.
   Expect ~86 pure renames; that is the known, accepted oversize of this stage.
   Do **not** move: `drift-sync/`, `scripts/`, `versions/`, `docs/`, `.claude/`, `skills/`,
   `images/`, `eslint.config.mjs` (stays at root, must cover `client/`), `vercel.json`
   (rewritten in stage 6 — leave it untouched), the root community files
   (README, CONTRIBUTING, LICENSE, etc.).
2. **Root `package.json` becomes the npm workspaces root** — `"workspaces": ["client"]`
   (add `"server"` in stage 3 when that folder exists; do not create `server/` now).
   Orchestration scripts only:
   - `dev:client` → plain Vite on :5173 in the client workspace.
   - `dev` → per plan becomes `vercel dev` (both services), but `vercel.json` Services
     config does not exist until stage 6. For now point `dev` at the client workspace
     (same as `dev:client`) and note it under `## Key decisions`; stage 6 switches it.
   - `build`, `lint`, `typecheck`, `test`-ready: `build`/`typecheck` fan out with
     `--workspaces`. **Never use `--if-present` on a gate script.** `lint` may stay a
     root `eslint .` since the eslint config stays at root — decide and record why.
   - `validate` is **not** fanned out: it stays the root script
     `tsx drift-sync/scripts/validate.ts`.
   - All `sync*` and `fresh` scripts stay at root unchanged.
   - Dependencies move into the workspace that uses them: `react`, `react-dom`,
     `framer-motion`, `gsap`, `vite`, `@vitejs/plugin-react`, `@types/react*` → client.
     `@anthropic-ai/sdk` and `tsx` stay at root for drift-sync. Shared lint/TS tooling
     (`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`,
     `typescript`, `@types/node`) — keep wherever `npm run lint` and drift-sync
     type-checking keep working; root is fine.
   - Keep `engines`, `homepage`, `repository`, `license`, `description` on the root.
3. **`client/package.json`** — new, `private`, `type: module`, scripts `dev`, `build`
   (`tsc -b && vite build`), `preview`, `typecheck` (`tsc -b --noEmit`). Never plain `tsc`
   without `-b`/`--noEmit` (emitted `.js` shadows `.tsx`).
4. **`client/vite.config.ts`**: `readdirSync('versions')` → `'../versions'`, and the
   `readFileSync(\`versions/...\`)` path likewise (lines 7 and 10 today). Make it robust to
   the cwd (resolve relative to the config file, e.g. via `fileURLToPath(import.meta.url)`),
   since `npm run build --workspaces` runs with cwd = `client/`.
5. **`.gitignore`**: add `client/dist/`, `server/dist/`, `**/tsconfig.tsbuildinfo`.
6. Run `npm install` at root so `package-lock.json` reflects the workspace layout
   (the lockfile change is part of this stage's Files).

## Plan text (§1, pasted — authoritative)

> **Target layout**
> ```
> project-cosmos/
> ├── package.json          ← npm workspaces root: ["client", "server"]; orchestration scripts only
> ├── client/               ← today's Vite app, moved as-is
> │   ├── index.html  vite.config.ts  tsconfig.json  package.json
> │   ├── public/
> │   └── src/              ← scenarios/, incidents/, map/, components/, hooks/, styles/ …
> ├── server/               ← new Node service (see §3)
> ├── drift-sync/           ← stays at root, repointed at client/src/scenarios
> ├── scripts/  versions/  docs/  .claude/  skills/
> ├── vercel.json           ← Services config (§2)
> └── eslint.config.mjs     ← stays at root, covers both workspaces
> ```
>
> - `client/vite.config.ts`: `readdirSync('versions')` becomes `'../versions'`.
> - Root `package.json`: `dev` runs `vercel dev` (both services). `dev:client` keeps plain
>   Vite on :5173. `build`, `lint`, `typecheck`, and `test` fan out with `--workspaces`.
>   `validate` is **not** fanned out: it stays the root script
>   `tsx drift-sync/scripts/validate.ts` (repointed at `client/src/scenarios`), and the
>   snapshot-freshness check lives inside it. No workspace has a `validate` script, so
>   fanning it out would either fail or, with `--if-present`, silently run nothing.
>   **Never use `--if-present` on a gate script.** Dependencies move into the workspace that
>   uses them. `@anthropic-ai/sdk` stays at root for drift-sync.
> - `.gitignore`: `client/dist/`, `server/dist/`, `**/tsconfig.tsbuildinfo`.
> - `CLAUDE.md` warning about emitted `.js` shadowing `.tsx` still applies to `client/`, so keep it.
>
> **Use `git mv` for every move** so history follows the files.

## Explicitly NOT this stage (later stages own them — do not touch)

- drift-sync imports/`WRITABLE_PATHS`/prompts/tsconfig/README, `scripts/fresh-start.mjs` → stage 2.
- `server/`, snapshot, validate freshness check → stage 3.
- Skills (`.claude/skills/*`, `skills/*`) → stage 4.
- `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `cosmos-sync.yml`, the full M0 verification
  gate (grep gate, corruption proof, sync dry-run, screenshots) → stage 5.
- `vercel.json`, Pages workflow → stage 6. Vitest/`npm test` → stage 7.

## Verification for this stage

- Must pass: `npm install`, `npm run build`, `npm run lint`, `npm run typecheck`.
- **Expected to break until stage 2** (report it, don't fix it): `npm run validate`,
  `npx tsc -p drift-sync --noEmit`, `npm run fresh` — drift-sync still imports `../../src/…`.
  State the exact failure in the report so stage 2 has a baseline.
- Quick runtime smoke: `npm run dev:client` starts and serves on :5173 (a curl of `/` returning
  the index HTML is enough; full browser verification is stage 5).
- Confirm `git status` shows the moves as renames (`R`), not delete+add.
