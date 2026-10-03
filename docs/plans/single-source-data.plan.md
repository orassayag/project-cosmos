# Single Source of Truth for Map Data — Plan

> **Superseded** by the server-owned data migration ([decision record](server-owned-data.md), [plan](server-owned-data-migration-plan.md)). The data moved to `server/src/cosmos/data/`, served at `GET /api/cosmos`; no shared `packages/cosmos-data` workspace was created. Kept for history only.

Base: `feature/add-ai` @ `3f6134a`

## Summary

The map data — domains, teams (owners), services, topics, scenarios, and incidents — moves out
of `client/` into one new npm workspace, `packages/cosmos-data`, that holds only pure data, Zod
schemas, and the types inferred from them. The client, the server, and drift-sync all import
that package. The committed snapshot `server/src/generated/cosmos-map.json` goes away: the server
builds the same map in memory from the package, after a parity test proves the in-memory build is
identical to the committed file.

Data stays as typed files in git, so every edit — human or nightly drift-sync — is still a
reviewable PR. This replaces `docs/pre-plans/database.plan.md`: a database would lose PR review of
AI-written edits and add a write API, hosting, migrations, and a client cache for a few hundred
fictional records. Reopen that option only if non-developers must edit data at runtime, per-user
data appears, or the record count reaches thousands.

Alongside the move, drift-sync's `toolWrite` is locked to its writable paths (a security fix that
lands first, on its own), lint rules guard the new package boundary, the drift agent and skills
get a JSON Schema of the data, and forks get an upgrade note.

## Scope

**In scope**
- `toolWrite` sandbox fix in drift-sync, with a test (first, standalone commit).
- New `packages/cosmos-data` workspace; `git mv` of pure data + types from `client/src/scenarios/`
  and `client/src/incidents/` (incidents included — they are in the snapshot today,
  `server/scripts/snapshot-map.ts:198`).
- One runtime rule for how every consumer (Vite, vitest, `tsx` scripts, Vercel function) loads the
  package, proven by explicit gates.
- Zod schemas for every data shape; types inferred from them; schemas run only in `validate` and
  tests.
- In-memory `serializeCosmosMap` on the server, proven equal to the committed JSON, then removal of
  the JSON, the `snapshot` script, and the freshness check.
- drift-sync paths, docs, skills, `scripts/fresh-start.mjs`, and every other hard-coded reference
  updated.
- Lint boundary rules, JSON Schema export for the agent/skills, README "Upgrading" note for forks.

**Out of scope**
- Database, write API, client data cache.
- Changing the Vercel deployment setup beyond what is required for the server to load the package
  (the Phase 2 preview build is a verification gate, not a deploy redesign).
- Publishing the package to npm, schema versioning, monorepo tooling (Turborepo/Nx).
- Runtime Zod parsing in the client or at server startup — `validate-on-pr.yml` already runs
  `validate` on every PR.

### Scope Yardstick

| Dimension | Value | Evidence |
|---|---|---|
| Kind | Open-source demo / template that forks clone and refill with their own data | `README.md`, `npm run fresh` (`scripts/fresh-start.mjs`), fictional AstroMart data (`CLAUDE.md`) |
| Audience & traffic | Maintainer, a few cloners, demo visitors; a few hundred fictional records | Plan: "a few hundred fictional records" |
| Surfaces | Static client plus a small server deployed as a Vercel function (`vercel.json` `services`, entrypoint `server/src/app.ts`); nightly drift-sync job that holds an Anthropic key and opens PRs, off by default (`DRIFT_SYNC_ENABLED` variable in `.github/workflows/cosmos-sync.yml`). No accounts, no money, no real user data | `vercel.json`, `cosmos-sync.yml`, `drift-sync/scripts/lib/agent.ts` |
| Lifetime | Long-lived, one maintainer, copied into forks | Versioned ledger (`versions/`), skills shipped for forks |
| Team | Solo | `CLAUDE.md` |
| Constraints | Data stays typed files in git; edits stay reviewable PRs; demo data stays; `npm run validate` and PR CI stay; tours ≤120s/60s; no database, write API or client cache | Plan "Why not a database" / "Out of scope"; `CLAUDE.md` |

## Issue Resolutions

| ID | Title | Detected by | Resolution | Notes |
|----|-------|------------|------------|-------|
| I1 | Source-only package export is only proven in Vite, not in the server, Vercel or drift-sync | claude, gpt, grok | Fixed | Conditional export (`development` → source, `default` → built `dist/`) plus a per-consumer gate list in Phase 2. |
| I2 | `toolWrite` can write anywhere in the repo | claude, gpt, grok, z.ai | Fixed | Phase 0, its own commit before the move: relative-path + `WRITABLE_PATHS` prefix check + symlink rejection, with a refusal test. |
| I3 | "Map equals agent types" test stays green if content changes | Claude (adversarial), claude, grok, gpt, Preplexity | Fixed | Parity test `serializeCosmosMap()` deep-equals the committed JSON + per-collection counts; JSON deleted only in the following commit. |
| I4 | Where Zod runs; inferred types may be looser | claude, grok | Fixed | Schemas only in `validate` and tests; client uses `import type`; `z.literal` for exact values; `satisfies z.input<…>` compile checks. |
| I5 | Update list misses hard-coded old paths | claude, grok | Fixed | Grep-driven checklist before Phase 4, covering `fresh-start.mjs`, `CONTRIBUTING.md`, README, skills, `WRITABLE_PATHS`. |
| I6 | drift-sync `WRITABLE_PATHS` stale between phases | claude, grok, Gemini | Fixed | `WRITABLE_PATHS` changes in the same commit as the move; drift-sync paused until one manual run passes. |
| I7 | Open questions already answerable; no base branch | gpt, z.ai, claude | Fixed | Incidents stated as in-scope fact; base pinned at the top of this plan. |

## Design

### Runtime rule for loading the package (applies to every phase)

`packages/cosmos-data/package.json`:

```json
{
  "name": "@project-cosmos/cosmos-data",
  "type": "module",
  "private": true,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -b",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run"
  }
}
```

- `dist/` is built by `tsc -b` (outDir `dist/`, never beside sources) and is gitignored. Emitting
  here is safe: the "never emit" rule in `CLAUDE.md` is about `.js` shadowing `.tsx` inside
  `client/`.
- The package is listed **first** in root `workspaces` so `npm run build --workspaces` builds it
  before `client` and `server`.
- **Source consumers** resolve `development`: Vite dev server (default condition), vitest (set
  `resolve.conditions: ['development']` in each workspace's vitest config if not picked up by
  default), and every `tsx` script — root scripts become `tsx --conditions=development …` so
  `npm run validate` and drift-sync always read the live data files, never a stale `dist/`.
- **Built consumers** resolve `default`: `vite build` and the Vercel server function. The Vercel
  build for the `server` service must run the package build first; if the function bundle does not
  pick up `node_modules/@project-cosmos/cosmos-data/dist`, add the package build to the server
  service's build command in `vercel.json`. If Vite fails to resolve the workspace, add a
  `resolve.alias` in `client/vite.config.ts`.
- Plain Node never loads `.ts` from `node_modules`, which is the failure the `default` → `dist/`
  export avoids.

### Phase 0 — Lock down `toolWrite` (S — one function, one shared constant, one test)

Standalone commit, landed before any data moves.

- Extract `WRITABLE_PATHS` (today duplicated in `drift-sync/scripts/apply-edits.ts:88` and
  `drift-sync/scripts/sync-nightly.ts:213`) into one exported constant in
  `drift-sync/scripts/lib/config.ts`; both scripts import it.
- `toolWrite` (`drift-sync/scripts/lib/agent.ts:81`) takes the writable list. After the existing
  repo-name prefix strip:
  1. `rel = path.relative(root, path.resolve(root, reqPath))`; reject if `rel` starts with `..` or
     is absolute.
  2. Require `WRITABLE_PATHS.some(w => rel === stripTrailingSep(w) || rel.startsWith(stripTrailingSep(w) + path.sep))`
     — the separator check blocks sibling-prefix escapes such as `packages/cosmos-data-evil/`.
  3. Walk from the target up to `root` with `fs.lstatSync` on every existing segment; reject if any
     is a symlink.
  4. Refusals return an `ERROR:` string naming the requested path, the resolved relative path, and
     the allowed prefixes (same return convention as today).
- **Verification:** new `drift-sync/scripts/lib/__tests__/agent.test.ts`, run with
  `tsx --test` via a new root script `test:drift-sync`, chained into root `npm test`. Cases:
  `.github/workflows/x.yml` → refused; `../outside.txt` → refused; sibling prefix → refused; a
  symlink inside a writable folder pointing outside → refused; a normal data file → written.
  Boundary protected: the applier, which reads untrusted code from other repos, can never write
  CI config or anything outside the data surface. Unit layer — the function is pure over a temp dir.

### Phase 1 — Inventory and boundaries (S — read-only survey)

- List every import from `client/src/scenarios` and `client/src/incidents` in `server/`,
  `drift-sync/`, `scripts/`, and tests.
- Classify each file in those folders: pure data/types (moves) vs. React/DOM/Vite-dependent (e.g.
  `brand.ts`, `health.ts`, `drift.ts`, `runner.ts` — stays in `client/`).
- Incidents are in the snapshot today (`server/scripts/snapshot-map.ts:198`, `INCIDENTS.map`), so
  they move into the package.
- Output: a checklist in the Phase 2 PR description. No automated test — no code changes.

### Phase 2 — Create `packages/cosmos-data` and move the data (M — one mechanical move plus wiring for four consumers)

- Add the workspace per the runtime rule above; TS project references from `client`, `server`, and
  `drift-sync/tsconfig.json`.
- `git mv` pure data + types (history preserved); `data.ts` barrel becomes `src/index.ts`.
- **Same commit:** update the shared `WRITABLE_PATHS` to the new data folder
  (`packages/cosmos-data/src/`), keeping `drift-sync/cosmos-confirmed.json`, so drift-sync never
  edits a shim.
- Temporary re-export shims at the old client paths keep this commit mechanical; the next commit
  updates imports and deletes the shims.
- **Drift-sync pause:** if `DRIFT_SYNC_ENABLED` is set on the repo, unset it before this commit and
  re-enable only after Phase 5 lands and one manual `workflow_dispatch` run passes.
- **Gates (all must pass before merging Phase 2):**
  - `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`.
  - Start the server once locally and hit one route (`/status`).
  - Run `npm run validate` and `npm run sync:diff-repo` (or `sync:apply` in dry-run) once.
  - Open a Vercel preview build and confirm the server function loads the package (no
    "cannot find module" / "unknown file extension .ts").
  - With `npm run dev` running, edit one data file and confirm the map hot-reloads.
  - Boundary protected: every runtime that loads the data works, so a break surfaces in the PR,
    not in production or the nightly job. These are manual smoke gates — the failure modes are
    bundler/deploy resolution, which no unit test in this repo exercises.

### Phase 3 — Zod schemas at the data boundary (M — one schema per shape plus validate rewiring)

- `packages/cosmos-data/src/schemas/`: `ServiceSchema`, `TopicSchema`, `DomainSchema`,
  `OwnerSchema`, `ScenarioSchema`, `StepSchema`, `IncidentSchema`; types exported alongside as
  `z.infer<…>` (one definition per shape; old hand-written types deleted).
- Zod is a dependency of the package, but **schemas run only in `validate.ts` and tests**. Client
  code imports data values and uses `import type` for types; no client module imports a schema.
  Verification: `vite build` output size compared before/after in the PR (must not grow by Zod's
  size), plus the A1 lint rule below.
- Keep types as strict as today: `z.literal(true)` (or `z.literal(...)` unions / `z.enum`) where
  the current types use exact values; avoid `.default()` on data fields so input and output types
  match.
- Compile-time checks in `packages/cosmos-data/src/__tests__/schemaTypes.test.ts` (or a
  `satisfies` block in `index.ts`): `SERVICES satisfies z.input<typeof ServiceSchema>[]` for every
  collection. Boundary: data that compiled before still compiles, and the types did not widen.
- Shape-level invariants in schemas: hex format, step-type enum, required fields.
- Cross-reference invariants (ids resolve, `phaseId` unique and global, step `phase` equals its
  scenario's `phaseId`, capsules ≥150px apart) stay explicit in `drift-sync/scripts/validate.ts`,
  which now parses with the schemas first and reports field-level errors (which record, which
  field, expected vs. received).
- **Tests:** `packages/cosmos-data/src/__tests__/schemas.test.ts` — every current collection
  parses; one broken fixture per rule is rejected with the expected path. Unit layer.

### Phase 4 — Replace the committed snapshot (M — builder move, parity proof, deletion, doc sweep)

- **Commit A:** move `serializeCosmosMap` into `server/src/` as an in-memory function over
  `@project-cosmos/cosmos-data`. Extend `server/src/__tests__/cosmosMap.test.ts`:
  - `expect(serializeCosmosMap()).toEqual(committedJson)` against the current
    `server/src/generated/cosmos-map.json`;
  - record count per collection (services, topics, scenarios, incidents, owners) equal to the JSON.
  - Boundary: the AI agent sees exactly the same map after the move — a dropped field, reordered
    step, or file left behind fails here. Unit layer.
- **Commit B:** switch `app.ts:14` and agent tests to `serializeCosmosMap()`; delete
  `cosmos-map.json`, the `snapshot` script (root and server), and `checkSnapshotFreshness()` in
  `validate.ts`. Replace the JSON-equality assertion with a stable structural assertion
  (per-collection counts + a spot check of one service, one scenario, one incident) so the test
  keeps guarding content without the file.
- **Path sweep (before Commit B):** run
  `grep -rn "src/scenarios\|src/incidents\|cosmos-map" --exclude-dir=node_modules --exclude-dir=.git .`
  and turn every hit into a checklist item in the PR. Known hits: `README.md` (layout, commands,
  "record an incident" steps), `CONTRIBUTING.md`, `CLAUDE.md` (Layout, "commit it with every data
  edit", `npm run snapshot`/`validate` lines), `scripts/fresh-start.mjs`,
  `drift-sync/scripts/sync-nightly.ts`, `apply-edits.ts`, `validate.ts`, `.claude/skills/`
  (`add-service`, `add-scenario`, `update`), and `skills/`. `WRITABLE_PATHS` drops the JSON entry.
  Verification: the grep returns no stale hits, and `npm run fresh` on a scratch clone clears the
  new data folder (no AstroMart left) and still builds.

### Phase 5 — drift-sync alignment (S — path updates on top of Phase 0/2)

- Point `validate.ts`, `apply-edits.ts`, and `diff-repo` at the package location (writable paths
  already moved in Phase 2; sandbox already fixed in Phase 0).
- Nightly flow unchanged: agent reads the repo, edits data files, opens a PR.
- Verification: one manual `workflow_dispatch` run of `cosmos-sync.yml` completes and its PR diff
  touches only files under `WRITABLE_PATHS`; then re-enable `DRIFT_SYNC_ENABLED` if it was on.

### A1 — Lint rules guarding the package boundary (XS — two config entries)

In `eslint.config.mjs`, `no-restricted-imports`:
- `files: ['server/**/*.ts', 'drift-sync/**/*.ts']` — ban `**/client/*` relative imports (patterns
  `../../client/*`, `../client/*`).
- `files: ['packages/cosmos-data/**/*.ts']` — ban `react`, `react-dom`, `vite`, `@vitejs/*`.
- `files: ['client/src/**/*.{ts,tsx}']` — ban `@project-cosmos/cosmos-data/schemas` value imports
  (supports the "no Zod in the browser" rule; `import type` stays allowed via
  `allowTypeImports: true`).
- Lands with Phase 2 (after the shims are removed). Verification: `npm run lint` green; temporarily
  adding a banned import fails lint (checked once by hand — no automated test for lint config).

### A2 — JSON Schema for the drift agent and skills (S — one script plus prompt/skill wiring)

- New `packages/cosmos-data/scripts/export-json-schema.ts` writes
  `packages/cosmos-data/generated/cosmos-data.schema.json` from the Zod schemas via
  `z.toJSONSchema()`. `npm run validate` runs it and fails if the committed file differs
  (same freshness pattern as before, but for a schema that changes rarely).
- The drift-sync applier prompt (`drift-sync/scripts/lib/cosmos-context.ts`) and the `add-service`
  / `add-scenario` skills include or reference that schema so entries are correctly shaped first
  time.
- Lands after Phase 3. Verification: `packages/cosmos-data/src/__tests__/jsonSchema.test.ts` asserts
  the exported schema validates every current record (via the JSON Schema, not Zod) — boundary: the
  schema handed to the agent matches what `validate` accepts. Unit layer.

### A3 — Upgrade note for existing forks (XS — README section)

- Add an "Upgrading" section to `README.md` with the exact `git mv` commands from the old
  `client/src/scenarios/` and `client/src/incidents/` paths to `packages/cosmos-data/src/`, plus
  "delete `server/src/generated/cosmos-map.json`; run `npm run validate`".
- Lands in Phase 6. Verification: follow the steps once on a scratch branch cut from before the
  move; `npm run build` and `npm run validate` pass. No automated test — documentation.

### Phase 6 — Docs, versioning, final verification (S)

- Version note via `scripts/version-note.sh write`; `README.md` updated (folder layout, commands,
  Upgrading) in the same commit.
- **Acceptance:** `npm run build`, `npm run typecheck`, `npm run lint`, `npm run validate`,
  `npm test` all green; run the app on a phone-class viewport then desktop; play one scenario and
  one incident; run `?demo=all` (≤120s) and `?demo=ai` (≤60s); ask the AI a question and confirm
  it still sees every service.

### Risks carried forward

- Stray emitted `.js` from `tsc` in `client/` would shadow sources — never run `tsc` without
  `--noEmit`/`-b` there. The package's own `dist/` is the one sanctioned emit target.
- Import churn touches many files: Phase 2 is one mechanical commit, separate from any behavior
  change.

### Size

M overall (Phases 2–4 carry the work; A1–A3 add ~5% of a session). No new infrastructure.
