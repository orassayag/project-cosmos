# Stage 5 work brief — M0: repoint CLAUDE.md, README, CONTRIBUTING, cosmos-sync.yml; run the M0 verification gate

## Scope for this stage
1. Repoint the remaining path consumers from the I2 checklist: `CLAUDE.md` (Layout, Commands, invariants' paths — keep the emitted-.js-shadows-.tsx warning, now applying to `client/`), `README.md`, `CONTRIBUTING.md`, `.github/workflows/cosmos-sync.yml` (any `src/scenarios` path in its steps). CLAUDE.md must be *enriched/edited in place*, never replaced wholesale. Commands sections should reflect real root scripts (`npm run dev`, `dev:client`, `build`, `typecheck`, `lint`, `validate`, `snapshot`) as they exist in package.json now — never invent a script (`test` does not exist until stage 7; `dev` swaps to `vercel dev` only in stage 6).
2. Run the full M0 verification gate below and record every result in the report's ## Summary.

## Carry-overs from earlier stages (ledger)
- `npx tsc -p drift-sync --noEmit` has never been run (permission denied in stages 1–3) — MUST run it now.
- `npx eslint <server file>` (e.g. server/scripts/snapshot-map.ts) never run — run it.
- The plan's `npm run sync -- --dry-run` does not exist; the real credential-free check is `npm run sync:bootstrap -- --dry-run` — use that (and say so in the report).
- Validate/typecheck ignore `client/src/scenarios/steps/core.ts` (pre-existing orphan) — out of scope, don't touch.

## Screenshot baseline note
The plan says to compare against screenshots of `main` taken before the move. You may NOT create a git worktree or switch branches. If you want a baseline, export main with `git archive main | tar -x -C <scratch dir outside repo>` and run it there; if that's impractical, take the current screenshots only and list the missing baseline under ## Open questions. Put screenshots under the session scratchpad or `.claude/status/stage-5-shots/` — never commit them.

## Plan text (docs/plans/add-ai.md §1 — Milestone 0, verbatim)
### §1 — Milestone 0: Repo reorganisation (client / server)

**Target layout**

```
project-cosmos/
├── package.json          ← npm workspaces root: ["client", "server"]; orchestration scripts only
├── client/               ← today's Vite app, moved as-is
│   ├── index.html  vite.config.ts  tsconfig.json  package.json
│   ├── public/
│   └── src/              ← scenarios/, incidents/, map/, components/, hooks/, styles/ …
├── server/               ← new Node service (see §3)
│   ├── package.json  tsconfig.json
│   ├── src/
│   │   └── generated/cosmos-map.json   ← committed snapshot of the map data (see below)
│   └── scripts/snapshot-map.ts
├── drift-sync/           ← stays at root, repointed at client/src/scenarios
├── scripts/  versions/  docs/  .claude/  skills/
├── vercel.json           ← Services config (§2)
└── eslint.config.mjs     ← stays at root, covers both workspaces
```

**How the server gets the map data without depending on `client/`.** The map data is the single source of truth, and it stays in `client/src/scenarios/`. drift-sync edits it there, and the skills target it there. `server/scripts/snapshot-map.ts` (run with tsx) imports only the pure data modules (`services`, `topics`, `scenarios`, `steps/*`, `owners`, `incidents/data` — **not** `runner.ts`, which is a React hook) and writes a compact JSON snapshot to `server/src/generated/cosmos-map.json`, which is committed. This keeps `server/` self-contained, so the Vercel server service never reaches outside its root. The snapshot can't silently go stale, for three reasons:
- `npm run validate` regenerates the snapshot in memory and fails when it differs from the committed file, with the message `cosmos-map.json is stale — run npm run snapshot`.
- `drift-sync/scripts/apply-edits.ts` runs `npm run snapshot` after it writes edits, and adds `server/src/generated/cosmos-map.json` to its `WRITABLE_PATHS`.
- `snapshot` is also exposed as a root script.

**Every path consumer to update (the I2 checklist):**
- `drift-sync/scripts/**`: the relative imports `../../src/…` and `../../../src/…` become `../../client/src/…` and `../../../client/src/…`. `WRITABLE_PATHS` and every prompt string in `apply-edits.ts:87-173` that says `src/scenarios/` becomes `client/src/scenarios/`. Also update `drift-sync/README.md` and `drift-sync/tsconfig.json` includes.
- `scripts/fresh-start.mjs`: the `src/scenarios` paths (lines 8, 16, 180).
- `client/vite.config.ts`: `readdirSync('versions')` becomes `'../versions'`.
- `.github/workflows/validate-on-pr.yml`: add the `npm test` step. Commands keep running from root through workspace scripts.
- `.github/workflows/cosmos-sync.yml`: any `src/scenarios` path in its steps.
- `.claude/skills/add-service`, `.claude/skills/add-scenario`, `skills/add-service`, `skills/add-scenario` (56 `src/` references in total).
- `CLAUDE.md` (Layout, Commands, invariants' paths), `README.md`, `CONTRIBUTING.md`.
- Root `package.json`: `dev` runs `vercel dev` (both services). `dev:client` keeps plain Vite on :5173. `build`, `lint`, `typecheck`, and `test` fan out with `--workspaces`. `validate` is **not** fanned out: it stays the root script `tsx drift-sync/scripts/validate.ts` (repointed at `client/src/scenarios`), and the snapshot-freshness check lives inside it. No workspace has a `validate` script, so fanning it out would either fail or, with `--if-present`, silently run nothing. **Never use `--if-present` on a gate script.** Dependencies move into the workspace that uses them. `@anthropic-ai/sdk` stays at root for drift-sync.
- `.gitignore`: `client/dist/`, `server/dist/`, `**/tsconfig.tsbuildinfo`.
- `CLAUDE.md` warning about emitted `.js` shadowing `.tsx` still applies to `client/`, so keep it.

**Use `git mv` for every move** so history follows the files.

**Verification (the "re-test and re-verify" the developer asked for)**
- Gate: `grep -rn "src/scenarios\|src/incidents" --exclude-dir={node_modules,client,dist} .` returns only `client/…`-prefixed hits. This proves no stale path survived.
- `npm run build`, `npm run lint`, `npx tsc -p drift-sync --noEmit`, and `npm run validate` all pass.
- `validate` is proven live, not vacuous: temporarily corrupt one step's `from` id in `client/src/scenarios/steps/` and confirm `npm run validate` exits non-zero naming the bad id, then revert. Repeat once with a hand-edited `cosmos-map.json` to see the stale-snapshot failure. *Protects: CI's "Validate Project Cosmos" step can never turn green without checking anything.*
- `npm run sync -- --dry-run` against one repo (per `drift-sync/README.md`) completes. This proves drift-sync can still read and resolve the map.
- Runtime: `npm run dev:client`, then drive the map with the `browser-drive` skill: play a scenario, open an incident, open the inspector, use a deep link. Do it at 390px first, then desktop, and compare against screenshots of `main` taken before the move.
- The milestone ships with no behaviour change. The screenshots are the proof.

