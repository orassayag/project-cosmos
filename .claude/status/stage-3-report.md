# Stage 3 report — P2: Move hardcoded domain knowledge into data

## Files
server/src/cosmos/apiTypes.ts
server/src/cosmos/schema.ts
server/src/cosmos/validate.ts
server/src/cosmos/index.ts
server/src/cosmos/data/palette.ts
server/src/cosmos/data/clusters.ts
server/src/cosmos/data/services.ts
server/src/cosmos/data/topics.ts
server/src/__tests__/phase2Equivalence.test.ts
server/src/__tests__/cosmosParity.test.ts
server/src/__tests__/cosmosSchema.test.ts
server/src/__tests__/validateCosmos.test.ts
server/src/__tests__/fixtures/baseline-full.json
server/src/__tests__/fixtures/baseline-full.phase0.json
client/src/scenarios/types.ts
client/src/scenarios/palette.ts
client/src/scenarios/clusters.ts
client/src/scenarios/services.ts
client/src/scenarios/topics.ts
client/src/map/ClusterBackdrop.tsx
client/src/map/UICluster.tsx
client/src/map/ShoppingCluster.tsx
client/src/map/FulfillmentCluster.tsx
client/src/map/EngagementCluster.tsx
client/src/map/NebulaField.tsx
client/src/map/ecosystem.ts
client/src/map/edge-resolver.ts
client/src/map/topic-groups.ts
client/src/map/Map.tsx
client/src/map/ServiceNode.tsx
client/src/map/ServicePanel.tsx
client/src/map/SubServicePanel.tsx
client/src/map/HealthCard.tsx
client/src/components/Spotlight.tsx
client/src/map/__tests__/clusters.test.tsx
client/src/__tests__/cosmosParity.test.ts
scripts/cosmos-check.ts
scripts/dump-baseline.ts
scripts/fresh-start.mjs
.claude/skills/add-service/SKILL.md
CLAUDE.md
docs/plans/server-owned-data-decisions.md

## Summary
Phase 2 is done. The client's rendering code no longer names any AstroMart service, topic or cluster. That knowledge now lives in data, and both data copies (server and client) got the same change.
- New data:
  - Services have `palette` instead of `color`.
  - A `palette` table maps each key to its hex.
  - `clusters` lists each cluster's members plus its nebula hues.
  - `realtime-hub` has an `ecosystem` describing the route through its sub-services.
  - Every topic has an explicit `groupServiceId`.
- Client changes:
  - One `ClusterBackdrop` replaces the four `*Cluster.tsx` files.
  - `NebulaField` reads `CLUSTERS`.
  - `edge-resolver.ts` and `Map.tsx` read `service.ecosystem`. The new `map/ecosystem.ts` builds the internal edges.
  - `topic-groups.ts` reads `groupServiceId`. The prefix rule and the alias are deleted.
  - Components get the color with `paletteVar()`.
- Validation and schema: Zod rejects unknown palette keys. `validateCosmos()` has 5 new error codes: `duplicate-cluster-id`, `service-hex-mismatch`, `unknown-cluster-service`, `unknown-topic-group` and `unknown-ecosystem-node`.
- Tests:
  - `phase2Equivalence.test.ts` checks each of the 12 services: `var(--svc-<palette>)` equals the Phase 0 `color`, and the palette hex equals the old `hex`. It also checks that groups built from `groupServiceId` deep-equal the Phase 0 `TOPIC_GROUPS`.
  - The client twin repeats the color check and also checks that every palette key has a `--svc-` token in `tokens.css`.
  - `clusters.test.tsx` renders a cluster with a renamed member, a cluster with an unknown id, and an empty cluster.
  - Parity tests now also cover `PALETTE` and `CLUSTERS`.
- A3: a new `phase 2` check in `cosmos:check` runs the plan's grep. It covers client `.ts`/`.tsx` files and skips data, incidents, demo and tests.
- Gates, all run in this stage on feature/add-ai with the changes uncommitted:
  - `npm run build`: ✅
  - `npm run typecheck`: ✅
  - `npm run lint`: ✅ 0 errors, 1 warning that was already there (the same exhaustive-deps warning, now at Map.tsx:821)
  - `npm test`: ✅ client 162/162 (152 + 10 new), server 182/182 (138 + 44 new), scripts 5/5. The demo tour time-limit tests are included and pass.
  - `npm run validate`: ✅ 0 errors, 0 warnings, no drift
  - `npm run cosmos:check -- --phase 2`: ✅ 6/6. Phases 0 (3/3) and 1 (5/5) are also green.
  - `npm run parity:screens`: ✅ 16/16, worst view 28 px (0.0014%)

## Commit message
refactor(map): move hardcoded cluster, ecosystem, topic-group and color knowledge into data

Phase 2 of the server-owned data migration: client rendering code stops naming AstroMart services,
so the data alone can rename or regroup them. The two allowed value changes (color→palette,
prefix rule→groupServiceId) are proven equivalent against the frozen Phase 0 fixture.

## Key decisions
(All of these are also in `docs/plans/server-owned-data-decisions.md`, in the Phase 2 section.)
- **The palette has 13 keys.** `yellow` is left out because nothing uses it and it has no existing hex. `violet` (`#a78bfa`) is in the table only because the UI nebula uses it.
- **The palette table belongs to the data**, so the server can check `hex === palette[key]`. This replaces the hex↔token check that Phase 1 could not port.
- **Only services moved to `palette`.** Topics, scenarios, owners, drift and health still use `color`.
- **Cluster geometry and styling stay client-side, keyed by cluster id.** The plan's table calls for this, and the values cannot be derived from the palette. A cluster id with no hand-tuned style gets a style built from its nebula hues.
- **`ecosystem` has 3 more fields than the plan lists**: `intakeTopicId`, `intakeSubServiceId` and `egressSubServiceId`. Without them the routes would still need hardcoded ids. Edge bends and the set of active sub-services are derived on the client.
- **No `role` field was added.** `Service.role` already exists as the panel subtitle. The one `storefront` special case is now derived from the steps that go `through` the service.
- **`groupServiceId` is required.** There is no fallback guess any more.
- **The expanded-ecosystem code path is still unreachable** (`expandedServiceId` is the constant `null`). Its refactor was checked by reading, not by a screenshot.
- **Fixture review:** I ran a script that deep-compares the two fixtures after removing the allowed changes. They are equal, so no other value changed, including every derived value. `baseline-cosmos-map.json` and the snapshot are unchanged.
- **Docs that became wrong were fixed:** the add-service skill, the hex invariant in `CLAUDE.md`, and the two template services in `fresh-start.mjs`. The add-service skill still says nothing about the server data copy. That gap dates from Phase 1 and is still open.
- The client parity test reads `tokens.css` with `node:fs` (with a `/// <reference types="node" />`). Vitest returns CSS imports as empty strings, even with `?raw`.
- **File count:** 42 paths. That is 4 deletions, 9 new files and 29 modified files, as the brief allowed. Every new or rewritten file is under 400 lines. `Map.tsx` was already 1286 lines and is now 1266.
