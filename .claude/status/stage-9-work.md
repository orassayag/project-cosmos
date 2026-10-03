# Stage 9 — work brief: P9 (Drift, health and demo data) + P10 (Retarget every writer)

Plan: docs/plans/server-owned-data-migration-plan.md. Decisions log: docs/plans/server-owned-data-decisions.md (append any ambiguity resolution there).

## Ground rules (plan, verbatim)
- Execute phases in order, one phase per branch or commit series; do not start a phase until the previous phase's acceptance passes. The plan targets v1.33.3+; if paths have moved, re-run the Phase 0 inventory and update paths first.
- `CLAUDE.md` wins on process: Conventional Commits, `scripts/version-note.sh write` before every commit, README check on every commit.
- Gates before every commit: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`. Never run `tsc` without `--noEmit`/`-b`.
- Repo invariants hold throughout: unique global `phaseId`; step `from`/`to`/`via`/`through` resolve; world 2400×1400; capsules ≥150px apart; AstroMart stays fictional.
- UI invariants hold throughout: mobile-first, one panel at a time on phones, top-right close control on every floating panel.
- Demo tours keep working after every phase: `?demo=all` ≤120s, `?demo=ai` ≤60s (`client/src/demo/__tests__/scripts.test.ts` or its current location guards them).
- The AstroMart map must look and behave identically after every phase.
- Ambiguity → smaller change, recorded in `docs/plans/server-owned-data-decisions.md`. Stop conditions are listed at the end.

## Plan sections for this stage (verbatim)

### Phase 9 — Drift, health and demo data

Fixtures:
- Add `source: 'fixture'` to drift and health in data and response. UI unchanged.
- System prompt: drift and health are AstroMart demo data; still answer from them.
- Record intended future producers (Drift Sync writes a drift entry on merge; health from an external source) in the decisions log. Not built here.

Demo tours:
- Add `demo` to server data: `allTour { scenarioId: 'shopping.place-order', incidentId: <newest incident id, explicit> }`, `aiTour { question, scriptedAnswer, highlightServiceIds }` (from `client/src/demo/scriptedAnswer.ts` and `DEMO_ANSWER_SERVICE_IDS`).
- Rewrite `client/src/demo/scripts.ts` and `scriptedAnswer.ts` to read `data.demo`; no AstroMart ids remain in `client/src/demo/`. Tours still drive the real UI only.
- *Tests:* `server/src/__tests__/demoData.test.ts` — every id in `demo` exists; every drift entry the scripted answer cites exists and is within 24h of `asOf`; `highlightServiceIds` are services; shifting a cited drift date by 2 days fails (protects against a silently stale scripted answer). Extend `agentEval.test.ts`: the agent's answer to `aiTour.question` cites the same drift entries as the scripted answer. Unit layer. `scripts.test.ts` keeps its timing limits, running against the response fixture.
- A3 check updated: `phase 9`: the Phase 2 grep no longer allows `client/src/demo/`.

**Acceptance:** `?demo=all` ≤120s and `?demo=ai` ≤60s (re-record both with `npm run record:demo -- all|ai`); a stale drift date fails a test; `npm run cosmos:check -- --phase 9` green.

### Phase 10 — Retarget every writer

```
grep -rn "client/src/scenarios\|client/src/incidents\|scenarios/data\|scenarios/services\|cosmos-map" --include=*.ts --include=*.mjs --include=*.md --include=*.yml --include=*.json . | grep -v node_modules | grep -v docs/plans/
```

| Writer or reader | Change |
| --- | --- |
| `drift-sync/scripts/lib/cosmos-context.ts` | Read `getCosmosData()` from `server/src/cosmos/` (repo tool, so reading server files is allowed) |
| `drift-sync/scripts/apply-edits.ts` + prompts | Allowed write paths → `server/src/cosmos/data/**`; prompts list `palette`, `clusters`, `groupServiceId`, `ecosystem` |
| `sync:bootstrap`, `sync.ts investigate-topic` | Read repos/topics from server data |
| `npm run validate` | Calls `validateCosmos()`; Drift Sync keeps only repo-existence checks |
| `npm run fresh` (`scripts/fresh-start.mjs`) | Writes the starter cosmos into `server/src/cosmos/data/`, incl. `brand`, `clusters`, `demo`, empty drift/health |
| Layout edit mode, Copy coords | Output matches `server/src/cosmos/data/services.ts`; help text updated |
| `.claude/skills/add-service`, `add-scenario`, `update`, and `skills/` plugin copies | New paths, fields, validation command |
| `scripts/record-demo.mjs`, `scripts/parity-screens.mjs` | Default `BASE_URL` = the `npm run dev` setup (`:5173` with proxy) |

- Apply each change. Run Drift Sync via `workflow_dispatch` on a branch (the `DRIFT_SYNC_ENABLED` gate applies to the scheduled trigger; if it also gates dispatch, temporarily set it to `true` for the dry run and back to `false`); confirm it edits `server/src/cosmos/data/`, passes validation, opens a draft PR.
- **Re-enable Drift Sync (I5):** `gh variable set DRIFT_SYNC_ENABLED --body true`; record in the decisions log.
- Run `npm run fresh` in a scratch clone; `npm run dev` renders the starter cosmos.
- *Tests:* existing Drift Sync tests updated to new paths; add `drift-sync/scripts/__tests__/applyEditsPaths.test.ts` asserting writes outside `server/src/cosmos/data/**` are rejected — protects the write boundary. Unit layer.
- A3 check added: `phase 10`: the grep above returns nothing outside `docs/plans/`.

**Acceptance:** grep empty; Drift Sync dry run and `npm run fresh` both work; `npm run cosmos:check -- --phase 10` green.

## Stop and ask the owner if (plan, verbatim)
- A Phase 0 baseline command fails on `main`.
- A data value must change to make a test pass — **except** the two Phase 2 changes named above (`color`→`palette`, prefix rule→`groupServiceId`), which are proven by equivalence tests instead.
- Vercel's CDN does not serve a new `version` after a deploy, or cold starts stay slow after lazy imports.
- The gzip size of `/api/cosmos` is over 100 KB (I7).
- The production `version` does not match the build's `COSMOS_VERSION` (I6).
- The digest grows more than 50% and trimming would remove information.
- Any change seems to need a database, write endpoint, auth or shared package.
- A phase would change how the map looks or behaves for a visitor.

## Orchestrator notes for this stage
- Carry-overs from stage 8 (ledger): regenerate the client test fixture with `npm run fixture:cosmos` after adding `data.demo` / `source`; drop the `client/src/demo/` exclusion in cosmos:check (Phase 2 grep and phase 8 check); `demo/scripts.ts` is the last client importer of old data, so the >500 kB bundle should shrink once it reads `data.demo`.
- Owner decision (stage 8 review, Q1 → A): which Ask map action `demo=ai` shows was deferred to Phase 9. CLAUDE.md requires every AI change be reflected in `demo=ai`. Decide the smallest change that shows one action without covering the typed answer (desktop `openPassport` opens beside the answer), keep ≤60s, record the choice in the decisions log. If no option works without changing how the tour behaves for a visitor beyond adding the action, ask (blocker file).
- Any API shape change (`source`, `demo`) goes through server `apiTypes.ts` + Zod schema, then `npm run types:emit` (CI diffs the client copy). Re-check the gzip budget test (<100 KB).
- **Outward-facing steps are NOT yours to run.** Do not run Drift Sync via `workflow_dispatch`, do not `gh variable set DRIFT_SYNC_ENABLED`, do not push. Make the code changes and local tests that make them possible, then list the exact commands as manual follow-ups under `## Open questions` (fenced, one per line). Same for "Run `npm run fresh` in a scratch clone": you may do it in a temp dir outside the repo only if it needs no network beyond npm install; otherwise list it.
- `npm run record:demo -- all|ai` re-recording: run if the local env supports it (dev ports 5173/5174 may be held by unrelated Vite — use `BASE_URL` as stage 7/8 did); report durations. If it cannot run, say so plainly.
- Phase 10 grep target: after this stage, `npm run cosmos:check -- --phase 10` must be green. The client data copies themselves (`client/src/scenarios/*`, `client/src/incidents/*`, `cosmos-map.json`, snapshot) are deleted in Phase 11 (stage 10) — not here. If the Phase 10 grep cannot be empty without deleting them, scope the phase-10 check to *writers/readers* (tools, skills, scripts, workflows) and record that in the decisions log.
- Gates (all must be green, report each): `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run validate`, `npm run cosmos:check -- --phase 10`, `npm run test:e2e`, `npm run parity:screens`.
- Version ledger / README: do not write the version note or commit. Update README.md if commands, paths or the Drift Sync flow it documents changed.
