# Master Stage Plan
Plan: docs/plans/server-owned-data-migration-plan.md
Branch: feature/add-ai
Split: medium (cap 10 stages, ~450 LOC/stage target)
Review budget: 120 minutes
Generated: 2026-10-02

## Scope estimate
~9,500 changed LOC (≈2,100 data lines copied server-side, ≈2,000 deleted in Phase 11, the rest new server/derive/route/agent/client/test/tooling code) across ~140 files → ceil(9500 / 450) = 22, clamped to the 10-stage cap; stages grow (~950 LOC avg), plan phases strictly in order.

## Stages
- Stage 1: COMMITTED — P0: baseline gates, Drift Sync pause, decisions log, dump-baseline fixtures, parity:screens + baseline screenshots, cosmos:check runner ⚠ large (~900 LOC + generated fixtures/PNGs)
- Stage 2: COMMITTED — P1: server/src/cosmos data copy, apiTypes/types, Zod schema, validateCosmos(), schema/validate/parity tests ⚠ large (~2,600 LOC, mostly copied data)
- Stage 3: COMMITTED — P2: palette, groupServiceId, clusters/nebula, ecosystem/role fields + component refactors, fixture regen, equivalence + clusters tests ⚠ large (~900 LOC)
- Stage 4: COMMITTED — P3: derive/* modules (graph, blastRadius, ownership, health, topicGroups, drift, playable) + getCosmosView() + derived parity ⚠ large (~900 LOC)
- Stage 5: COMMITTED — P4+P5: GET /api/cosmos (ETag/304/cache), lazy AI imports, print-cosmos-version, types:emit + CI diff, route/isolation/emit tests ⚠ large (~750 LOC)
- Stage 6: COMMITTED — P6: agents on getCosmosView(), digest additions, read tools, new map actions, unknown-action test, agent eval suite ⚠ large (~900 LOC)
- Stage 7: COMMITTED — P7: no-account dev loop, cosmosClient (retry-safe), CosmosProvider, loading gate + error/Retry, A1 Playwright E2E + CI job ⚠ large (~850 LOC)
- Stage 8: COMMITTED — P8: migrate every client feature to useCosmos(), renderWithCosmos fixture, Ask map-action handlers ⚠ large (~1,400 LOC)
- Stage 9: PLANNED — P9+P10: drift/health source + demo data server-side, demo scripts rewrite, retarget Drift Sync/validate/fresh/skills/record-demo ⚠ large (~900 LOC)
- Stage 10: PLANNED — P11+P12: delete client data copies + snapshot tooling, docs (README/CLAUDE.md/CONTRIBUTING/decision record), dev live polling + tests ⚠ large (~2,300 LOC, mostly deletions)
