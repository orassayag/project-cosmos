# Stage 4 work brief — M0: repoint skills to client/src

Plan: docs/plans/add-ai.md (§1 — Milestone 0). Branch: feature/add-ai.

## Stage scope (from the stage plan)
Stage 4: M0: repoint skills (.claude/skills + skills/ add-service, add-scenario) to client/src

**Out of scope for this stage** (do NOT touch):
- `CLAUDE.md`, root `README.md`, `CONTRIBUTING.md`, `.github/workflows/cosmos-sync.yml`, and the full M0 verification gate → stage 5.
- Anything under `client/`, `server/`, `drift-sync/`, `scripts/` (already done in stages 1–3).

## Plan text (pasted verbatim, §1 — the parts this stage implements)

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

**How the server gets the map data without depending on `client/`.** The map data is the single source of truth, and it stays in `client/src/scenarios/`. drift-sync edits it there, and the skills target it there. `server/scripts/snapshot-map.ts` (run with tsx) imports only the pure data modules … and writes a compact JSON snapshot to `server/src/generated/cosmos-map.json`, which is committed. … The snapshot can't silently go stale, for three reasons:
- `npm run validate` regenerates the snapshot in memory and fails when it differs from the committed file, with the message `cosmos-map.json is stale — run npm run snapshot`.
- `drift-sync/scripts/apply-edits.ts` runs `npm run snapshot` after it writes edits, and adds `server/src/generated/cosmos-map.json` to its `WRITABLE_PATHS`.
- `snapshot` is also exposed as a root script.

**Every path consumer to update (the I2 checklist) — this stage's line:**
- `.claude/skills/add-service`, `.claude/skills/add-scenario`, `skills/add-service`, `skills/add-scenario` (56 `src/` references in total).

**Verification (subset relevant to this stage)**
- Gate (scoped to this stage's files): `grep -rn "src/" .claude/skills skills` — every map-data path reference is `client/src/…`-prefixed. References to *other repos'* `src/` (e.g. tracing a real service's source) are not Project Cosmos paths and must stay as-is — use judgment, and list any ambiguous hit in the report.
- `npm run validate` still passes (skills are docs; nothing should change, but confirm).

## Stage-specific notes (from ledger)
- Data edits now require `npm run snapshot` before `npm run validate` (validate fails on a stale `server/src/generated/cosmos-map.json`). Wherever a skill's procedure tells the reader to run `npm run validate` / `npm run build` after editing map data, add the `npm run snapshot` step before validate, and name the snapshot file as a file the procedure touches.
- Layout mentions like `src/styles/tokens.css`, `src/map/…`, `src/components/…` also moved under `client/src/…` — repoint those too.
- If `skills/` and `.claude/skills/` are duplicate copies, keep them consistent with each other.
