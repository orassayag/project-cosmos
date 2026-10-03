# Decisions

The per-feature decision log — newest first. One entry per finalized plan, written when
the feature lands: `/master approve` on the final stage, the end of an `/orca` run, or
`/publish`. Each entry records which review recommendations (R1, R2, …) were accepted
and which were not, when, and why — including the pain point behind each one.
Per-commit history lives in `versions/`; that is the *what*, this file is the *why*.

<!-- decisions:entries -->

## Server-owned data migration — 2026-10-03
<!-- plan: docs/plans/server-owned-data-migration-plan.md -->
**Plan:** `docs/plans/server-owned-data-migration-plan.md` · **Landed via:** /master approve · **Version:** v1.42.0

**Why this feature:** The map's data lived inside the web app and the AI agents only saw a partial snapshot of it, so the agent and the map could disagree and the AI demo had to fake its answer. The server now owns all the data and every computed fact, and both the map and the agents read the same view.

| # | Decision | Status | Why | Pain point behind it |
|---|----------|--------|-----|----------------------|
| R1 | Move the no-account local dev setup (Node server + Vite `/api` proxy) into Phase 7 | ✅ Selected | Every check from Phase 7 on needs the app running locally | Halfway through the migration the app showed only an error locally, and forks needed a Vercel account |
| R2 | Forget a failed data request so Retry really refetches | ✅ Selected | The Phase 7 "Retry recovers" check could not pass otherwise | Once loading failed, Retry did nothing until a full page reload |
| R3 | Make `apiTypes.ts` self-contained and copy it to the client instead of compiling declarations | ✅ Selected | The compiler would write several files, not the one the client imports | The browser/server type check would have watched files nobody uses |
| R4 | Allow exactly two proven fixture changes in Phase 2 (`color`→`palette`, prefix→`groupServiceId`) | ✅ Selected | The plan's own "no value may change" rule contradicted Phase 2 | The migration would either stall or keep the old color coupling |
| R5 | Pause Drift Sync via the `DRIFT_SYNC_ENABLED` variable and drain its open PRs | ✅ Selected | Scheduled workflows only read the default-branch file; the variable is the real switch | The nightly bot could keep editing the old files mid-move |
| R6 | Print the data version at build and compare it to production after deploy | ✅ Selected | One preview cache hit cannot prove a new deploy serves new data | A release could keep showing an old map while every check passed |
| R7 | Stop and ask when the response exceeds its 100 KB size target | ✅ Selected | Every other target already had a stop rule | Whoever did the work would have had to decide alone |
| D1 | Keep the server parity test after the migration; docs explain updating its fixture on a deliberate data change | ✅ Selected | Conservative choice at stage 10 | Not recorded |
| D2 | Document, not fix, that server tests fail after `npm run fresh` | ✅ Selected | Conservative choice at stage 10; decision left to the owner | Not recorded |
| D3 | Dev-only live polling of `/api/cosmos` with `cache: 'no-store'` | ✅ Selected | The route's 60s browser cache would otherwise hide edits | A data edit would not reach the open map while developing |
