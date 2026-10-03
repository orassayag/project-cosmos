# Stage 2 report — P1: Move the data into the server

## Files
server/src/cosmos/apiTypes.ts
server/src/cosmos/types.ts
server/src/cosmos/schema.ts
server/src/cosmos/validate.ts
server/src/cosmos/index.ts
server/src/cosmos/data/brand.ts
server/src/cosmos/data/domains.ts
server/src/cosmos/data/services.ts
server/src/cosmos/data/topics.ts
server/src/cosmos/data/scenarios.ts
server/src/cosmos/data/owners.ts
server/src/cosmos/data/drift.ts
server/src/cosmos/data/health.ts
server/src/cosmos/data/steps/shopping.ts
server/src/cosmos/data/steps/fulfillment.ts
server/src/cosmos/data/steps/engagement.ts
server/src/cosmos/data/incidents/payment-cascade-2026-03-12.ts
server/src/cosmos/data/incidents/inventory-oversell-2026-05-04.ts
server/src/cosmos/data/incidents/hub-silence-2026-07-19.ts
server/src/__tests__/cosmosSchema.test.ts
server/src/__tests__/validateCosmos.test.ts
server/src/__tests__/cosmosParity.test.ts
client/src/__tests__/cosmosParity.test.ts
scripts/cosmos-check.ts
docs/plans/server-owned-data-decisions.md

## Summary
Phase 1 is done. The data now has a server copy under `server/src/cosmos/`, which follows the plan's layout. The client copy is unchanged; the only client addition is the twin parity test.
- `getCosmosData()` (`index.ts`) builds the data once on first call, deeply freezes it, and returns that same object every time. Its shape is `{ brand, domains, services, topics, scenarios, steps, incidents, owners{teams,fallback,serviceOverrides}, drift{runTimeUtc,entries}, health{asOf,services,onCallByTeam} }`.
- `apiTypes.ts` has no imports (I3). `types.ts` re-exports it and adds `CosmosValidationIssue`. `schema.ts` defines strict Zod schemas, each ending in `satisfies z.ZodType<T>`.
- `validateCosmos()` returns `{ errors, warnings }` with 16 named error codes plus the `service-no-owner` warning.
- Tests:
  - `cosmosSchema.test.ts` (3): the data parses, is frozen and is memoized; an unknown field is rejected.
  - `validateCosmos.test.ts` (20): real data is clean; one broken clone per rule; a dangling incident step reports its `incidentId`; capsules 100px apart report their ids and the distance; the warning path.
  - Parity: the server test and its client twin each deep-equal 12 raw-data keys of `baseline-full.json`.
- A3: `cosmos:check` has 2 new `phase 1` entries: the module files exist, and nothing under `server/src` imports `client/` or `drift-sync/`. The grep pattern was confirmed to match the real `server/scripts/snapshot-map.ts` import.
- Gates, all run in this stage on feature/add-ai with the changes uncommitted:
  - `npm run build`: ✅
  - `npm run typecheck`: ✅
  - `npm run lint`: ✅ 0 errors, 1 warning that was already there (Map.tsx:814)
  - `npm test`: ✅ client 152/152 (140 + 12 new), server 138/138 (103 + 35 new), scripts 5/5
  - `npm run validate`: ✅ 0 errors, 0 warnings
  - `npm run cosmos:check -- --phase 1`: ✅ 5/5
  - `npm run parity:screens`: ✅ 16/16, worst view 63 px (0.0030%)
- `git diff -- client/` is empty.
- Not verified: I did not deliberately break a client data value to watch the client twin fail. It is a plain deep-equal, so this is low risk.

## Commit message
feat(server): copy cosmos data into server/src/cosmos with schema and validation

Phase 1 of the server-owned data migration: the server gets its own frozen copy of the map
data, typed by a self-contained apiTypes.ts and checked by Zod schemas plus validateCosmos().
Parity tests pin both the server and client copies to the Phase 0 baseline so they cannot drift.

## Key decisions
(All of these are also in `docs/plans/server-owned-data-decisions.md`, in the Phase 1 section.)
- **The server copy holds facts only.** Presentation metadata stays on the client: `DRIFT_KIND_META`, `HEALTH_STATUS_META` and `INCIDENT_COMET_HEX`. Lookup maps, `LATEST_DRIFT_*` and all helpers are left for Phase 3. `steps/core.ts` was not copied.
- **Parity compares only the raw-data keys.** `STEPS_BY_SCENARIO` and `LATEST_DRIFT_*` are derived, so they wait for Phase 3. `SERVICE_OVERRIDES`, `ON_CALL_BY_TEAM` and `DRIFT_RUN_TIME_UTC` are not in the fixture, so no test checks them; they were copied by hand.
- **The capsule ≥150px rule covers services only.** One topic node is 148px from a service today, so checking topics would fail on unchanged data.
- **Not ported from the old validator:** the hex↔color-token check (it needs the client's `tokens.css`; Phase 2's `palette` replaces it), snapshot freshness, and the source-repo greps.
- **The A3 import check covers `server/src` only.** `server/scripts/snapshot-map.ts` still imports the client copy. It is existing tooling that Phase 11 deletes, so I left it alone.
- **Known gap in `satisfies z.ZodType<T>`:** it does not catch an optional type field that the schema leaves out.
- `zod` was already a server dependency, so no package changed.
- File count is about 25, as the brief allowed. Every file is under 400 lines; the largest is `steps/shopping.ts` at 195.
