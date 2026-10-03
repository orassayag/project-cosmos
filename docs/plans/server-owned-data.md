# Decision record — the server owns the map data

**Status:** accepted and implemented (migration Phases 0–12, branch `feature/add-ai`). Phase 13 (deploy and production verification) is tracked in the plan.

## Decision

The map's data (services, topics, domains, scenarios, steps, incidents, owners, drift, health, demo tours, brand, palette, clusters) lives as typed TypeScript under `server/src/cosmos/data/`, in git. The server validates it (Zod schemas and `validateCosmos()`), computes every derived fact once (`getCosmosView()`), and serves it as `GET /api/cosmos` with an `ETag` and CDN caching. The client holds no domain data: it fetches that response once at startup and renders it; in dev only it polls every 2s so a data edit reaches the open map. The AI agent reads the same view, so its answers and the map cannot disagree.

There is no database, no write endpoint and no shared package. Every data change, including Drift Sync's, is a reviewed commit to `server/src/cosmos/data/`.

## Consequences

- The server is required to run the app, locally (`npm run dev`) and when deployed (both Vercel services).
- The client's copy of the response types is emitted from `server/src/cosmos/apiTypes.ts` (`npm run types:emit`); CI fails on a stale copy.
- The old client data (`client/src/scenarios/`, `client/src/incidents/`), the `cosmos-map.json` snapshot and its script are deleted.
- `server/src/__tests__/cosmosParity.test.ts` still pins the data to `baseline-full.json`, so a deliberate data change updates that fixture in the same PR.

## Links

- Plan: [server-owned-data-migration-plan.md](server-owned-data-migration-plan.md)
- Decisions made while executing it: [server-owned-data-decisions.md](server-owned-data-decisions.md)
- Superseded: [single-source-data.plan.md](single-source-data.plan.md) (a shared `packages/cosmos-data` workspace imported by client and server)
