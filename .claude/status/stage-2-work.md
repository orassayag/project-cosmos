# Stage 2 work brief — M0: repoint drift-sync + scripts/fresh-start.mjs to client/src

Plan: docs/plans/add-ai.md (§1 — Milestone 0). Branch: feature/add-ai.

## Stage scope (from the stage plan)
Stage 2: M0: repoint drift-sync (imports, WRITABLE_PATHS, prompts, tsconfig, README) + scripts/fresh-start.mjs to client/src

**Out of scope for this stage** (later stages own them — do NOT touch):
- `server/` workspace, `snapshot-map.ts`, `cosmos-map.json`, the validate snapshot-freshness check, the
  apply-edits `npm run snapshot` hook, and adding `server/src/generated/cosmos-map.json` to `WRITABLE_PATHS` → stage 3.
- `.claude/skills/*`, `skills/*` → stage 4.
- `CLAUDE.md`, root `README.md`, `CONTRIBUTING.md`, `.github/workflows/cosmos-sync.yml`, and the full M0 verification gate → stage 5.

## Plan text (pasted verbatim, §1 — the parts this stage implements)

**Every path consumer to update (the I2 checklist):**
- `drift-sync/scripts/**`: the relative imports `../../src/…` and `../../../src/…` become `../../client/src/…` and `../../../client/src/…`. `WRITABLE_PATHS` and every prompt string in `apply-edits.ts:87-173` that says `src/scenarios/` becomes `client/src/scenarios/`. Also update `drift-sync/README.md` and `drift-sync/tsconfig.json` includes.
- `scripts/fresh-start.mjs`: the `src/scenarios` paths (lines 8, 16, 180).

Root `package.json`: … `validate` is **not** fanned out: it stays the root script `tsx drift-sync/scripts/validate.ts` (repointed at `client/src/scenarios`) … **Never use `--if-present` on a gate script.** … `@anthropic-ai/sdk` stays at root for drift-sync.

**Verification (subset relevant to this stage)**
- `npm run build`, `npm run lint`, `npx tsc -p drift-sync --noEmit`, and `npm run validate` all pass.
- `validate` is proven live, not vacuous: temporarily corrupt one step's `from` id in `client/src/scenarios/steps/` and confirm `npm run validate` exits non-zero naming the bad id, then revert. (The stale-snapshot half of this check belongs to stage 3.)
- `npm run sync -- --dry-run` against one repo (per `drift-sync/README.md`) completes, if it can run without network credentials; otherwise report why not.

## Stage-specific notes from stage 1 (see ledger)
- `npm run validate` currently fails with ERR_MODULE_NOT_FOUND on `/src/scenarios/services.js` — this stage must make it pass.
- Capture the `npx tsc -p drift-sync --noEmit` result (stage 1 could not run it).
- Do NOT run `npm run fresh` — it overwrites scenario data irreversibly. Verify `fresh-start.mjs` by reading/grep, or by pointing it at a scratch copy if it supports that; never against the real tree.
- Also grep drift-sync for any other root-relative `src/` strings (e.g. `path.join(root, 'src', …)`, globs) beyond the ones the plan names — the plan's line numbers are hints, sweep the whole folder.
