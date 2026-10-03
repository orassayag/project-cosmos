# Stage 10 work brief — P11 (delete old sources) + P12 (docs, dev live polling, forks)

Plan: docs/plans/server-owned-data-migration-plan.md. Spec: none.
This is the final stage. Phase 13 (deploy/production verification) is NOT in scope.

## Ground rules (from the plan)
### Ground rules for the executing agent

- Execute phases in order, one phase per branch or commit series; do not start a phase until the previous phase's acceptance passes. The plan targets v1.33.3+; if paths have moved, re-run the Phase 0 inventory and update paths first.
- `CLAUDE.md` wins on process: Conventional Commits, `scripts/version-note.sh write` before every commit, README check on every commit.
- Gates before every commit: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`. Never run `tsc` without `--noEmit`/`-b`.
- Repo invariants hold throughout: unique global `phaseId`; step `from`/`to`/`via`/`through` resolve; world 2400×1400; capsules ≥150px apart; AstroMart stays fictional.
- UI invariants hold throughout: mobile-first, one panel at a time on phones, top-right close control on every floating panel.
- Demo tours keep working after every phase: `?demo=all` ≤120s, `?demo=ai` ≤60s (`client/src/demo/__tests__/scripts.test.ts` or its current location guards them).
- The AstroMart map must look and behave identically after every phase.
- Ambiguity → smaller change, recorded in `docs/plans/server-owned-data-decisions.md`. Stop conditions are listed at the end.


### Phase 11 — Delete the old sources

One revertible commit:
- `client/src/scenarios/` data modules (`services.ts`, `topics.ts`, `scenarios.ts`, `data.ts`, `owners.ts`, `drift.ts`, `health.ts`, `brand.ts`, `types.ts`, `steps/` incl. `core.ts`).
- `client/src/incidents/` data and types.
- `server/src/generated/cosmos-map.json`, `server/src/agent/types/cosmosMapSnapshot.ts`, `server/scripts/snapshot-map.ts`, the `snapshot` script and its freshness check in `validate`.
- The client parity twin. The server parity test stays, guarding data against `baseline-full.json` until a deliberate data change updates it.
- Client helpers with no importers (`npx knip`), each confirmed by hand.

If the build breaks, finish the missed Phase 8 row instead of restoring files.

A3 check added: `phase 11`: none of the deleted paths exist; no `cosmos-map` reference anywhere outside `docs/`.

**Acceptance:** `npm run build`, `npm test`, `npm run validate`, CI, `npm run parity:screens`, `npm run test:e2e`, `npm run cosmos:check -- --phase 11` all green.

### Phase 12 — Docs, live data in dev, forks

The dev loop already exists (Phase 7); this phase adds live reload and docs.

Docs:
- README: principle #1 becomes "the server owns the map, in git; the client renders it"; keep "no database"; remove "works with no server"; update tech stack, quickstart, and the scripts list (`dev`, `dev:server`, `types:emit`, `test:e2e`, `parity:screens`, `cosmos:check`).
- `CLAUDE.md` (merge, never overwrite): new data paths, the now-accurate validation list, "the client holds no domain data", the new commands.
- `CONTRIBUTING.md`, `drift-sync/README.md`: new paths and fields.
- `docs/plans/server-owned-data.md`: short decision record linking this plan and the decisions log; mark the single-source-of-truth plan superseded.

Live data in dev:
- In `cosmosClient.ts`, guarded by `import.meta.env.DEV`: poll `/api/cosmos` with `If-None-Match` every 2s; on 200 with a new `version`, swap it into `CosmosProvider`.
- `tsx watch` already restarts the server when `server/src/cosmos/data/**` changes; confirm, and add the path to the watch list if not.
- *Tests:* `client/src/api/__tests__/devPolling.test.ts` — with `DEV` true, a 200 with a new version updates the provider and a 304 does not; `client/src/__tests__/noDevPollingInProd.test.ts` asserts the production bundle (`vite build` output) contains no polling interval string — protects "never ships to production". Unit layer.

Forks: quickstart is clone → `npm install` → `npm run fresh` → `npm run dev` → deploy both Vercel services; state plainly that the server is required.

A3 check added: `phase 12` — every Definition-of-done item below that is greppable (no AstroMart ids in `client/src/` outside tests and `client/src/api/cosmos-api.ts`; no `cosmos-map`/snapshot step; README and `CLAUDE.md` mention `server/src/cosmos/data`).

**Acceptance:** editing a capsule label in `server/src/cosmos/data/services.ts` during `npm run dev` updates the open map within 3s; a fresh clone following only the README reaches a running map with no Vercel login; `npm run cosmos:check` (all phases) green.


### Definition of done

- No domain data or AstroMart ids in `client/src/` outside tests and `client/src/api/cosmos-api.ts`.
- No `cosmos-map.json` and no snapshot step.
- The agent answers drift, health, on-call, payload and blast-radius questions from data and drives the new map actions.
- The map loads when the AI stack is broken.
- Drift Sync, `npm run fresh`, skills and validation work against `server/src/cosmos/data/`.
- README, `CLAUDE.md` and the decision record describe the new architecture.
- `npm run cosmos:check`, `npm run test:e2e` and `npm run parity:screens` are green.

### Risks

| Risk | Mitigation |
| --- | --- |
| A client feature is missed and breaks after deletion | Phase 8 checklist; A1 E2E and A2 screenshot diff after every row; Phase 11 is one revertible commit |
| Local dev broken mid-migration | No-account dev loop lands first in Phase 7 (I1); A1 boots it in CI |
| Retry stuck on a failed promise | Cached promise cleared on failure, abort on timeout, tested (I2) |
| Client and server shapes drift | Single self-contained `apiTypes.ts` copied by `types:emit`, CI diff (I3) |
| Drift Sync writes to the old path mid-migration | `DRIFT_SYNC_ENABLED=false` + open PRs drained before Phase 1, re-enabled in Phase 10 (I5) |
| Stale CDN data after a deploy | Build-logged `version` compared to production response (I6) |
| Cold starts slow first paint | CDN caching + lazy AI imports (Phase 4); measured in Phase 13 |
| Digest raises AI cost | Token budget check (Phase 6); payloads via tools |
| Scripted demo answer goes stale | Tests tying it to drift data (Phase 9) |

### Stop and ask the owner if

- A Phase 0 baseline command fails on `main`.
- A data value must change to make a test pass — **except** the two Phase 2 changes named above (`color`→`palette`, prefix rule→`groupServiceId`), which are proven by equivalence tests instead.
- Vercel's CDN does not serve a new `version` after a deploy, or cold starts stay slow after lazy imports.
- The gzip size of `/api/cosmos` is over 100 KB (I7).
- The production `version` does not match the build's `COSMOS_VERSION` (I6).
- The digest grows more than 50% and trimming would remove information.
- Any change seems to need a database, write endpoint, auth or shared package.
- A phase would change how the map looks or behaves for a visitor.


## Carry-over from stage 9 (open questions the owner has not yet answered — decide conservatively, record in docs/plans/server-owned-data-decisions.md, raise under Open questions)
## Open questions
1. **The first real Drift Sync data edit will fail CI.** `server/src/__tests__/cosmosParity.test.ts` deep-compares the server data with the frozen `baseline-full.json`, and `npm test` runs in CI on every PR. Should Drift Sync PRs update that fixture, or should the parity test be retired once Phase 11 lands? Phase 11 keeps it "until a deliberate data change updates it".
2. **After `npm run fresh`, `npm run build` fails.** The server `tsc -p .` covers AstroMart-specific tests that name `team-shopping` and others, and the parity tests fail too. `npm run dev` works. Phase 12 (forks) should decide: `fresh` could also remove or skip the AstroMart-only tests, or those tests could read ids from the data.
3. **Outward-facing steps for the owner,** after pushing this branch. The job's `if: vars.DRIFT_SYNC_ENABLED == 'true'` also gates manual dispatch. Use `mode=live` to see the edit, validation and draft PR; leave the variable `true` afterwards, which is I5. Record the result in the decisions log.
