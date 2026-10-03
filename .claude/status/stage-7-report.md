# Stage 7 report — P7: Local dev loop, client data layer and loading

## Files
.github/workflows/validate-on-pr.yml
.gitignore
CLAUDE.md
README.md
package.json
package-lock.json
client/vite.config.ts
client/src/main.tsx
client/src/App.tsx
client/src/api/cosmosClient.ts
client/src/api/CosmosProvider.tsx
client/src/api/useCosmosLoad.ts
client/src/api/__tests__/cosmosClient.test.ts
client/src/__tests__/loadingGate.test.tsx
client/src/components/CosmosLoadError.tsx
client/src/components/WarpTransition.tsx
client/src/demo/useDemoRunner.ts
client/src/demo/__tests__/useDemoRunner.test.ts
client/src/styles/app.css
client/src/hooks/useMapView.ts
client/src/hooks/__tests__/useMapView.test.ts
server/scripts/dev-server.ts
e2e/playwright.config.ts
e2e/cosmos-load.spec.ts
scripts/cosmos-check.ts
scripts/parity-screens.mjs
docs/plans/server-owned-data-decisions.md
docs/plans/baseline-screens/default-map.png
docs/plans/baseline-screens/scenario-shopping.search.png
docs/plans/baseline-screens/scenario-shopping.place-order.png
docs/plans/baseline-screens/scenario-fulfillment.pack-and-ship.png
docs/plans/baseline-screens/scenario-fulfillment.cancel-refund.png
docs/plans/baseline-screens/scenario-engagement.back-in-stock.png
docs/plans/baseline-screens/incident-hub-silence-2026-07-19.png
docs/plans/baseline-screens/incident-inventory-oversell-2026-05-04.png
docs/plans/baseline-screens/incident-payment-cascade-2026-03-12.png
docs/plans/baseline-screens/blast-payments.png
docs/plans/baseline-screens/health-view.png
docs/plans/baseline-screens/ownership-view.png
docs/plans/baseline-screens/drift-overlay.png
docs/plans/baseline-screens/changelog-open.png
docs/plans/baseline-screens/realtime-hub-selected.png
docs/plans/baseline-screens/mobile-default-map.png

## Summary
`npm run dev` now starts Vite (:5173) and a Hono dev server (`server/scripts/dev-server.ts`, :8787, `tsx watch`) together through `concurrently`, and Vite proxies `/api` to it. No Vercel account is needed. `dev:client` and the new `dev:server` start one side each. The client starts `GET /api/cosmos` in `main.tsx` before `createRoot`. `startCosmosFetch()` caches its promise, aborts after 10s, and forgets a failed attempt so Retry really refetches (I2). App now has a loading gate: intro → CTA warp holds at cruise speed until data is ready; intro skipped → a held warp is the loading screen; failure → a full-screen error with Retry and a README link. `CosmosProvider` wraps the shell once data is ready, demo tours start only after that, and no component uses `useCosmos()` yet. A1: Playwright spec `e2e/cosmos-load.spec.ts` (4 tests), `npm run test:e2e`, and a new `e2e` CI job. The README dev section, the CLAUDE.md command list, cosmos:check phase 7 (5 checks) and the decisions log are updated.

Parity follow-up (owner chose "fix both, retake all 16"): `useMapView.fitTarget` now sizes the fit from the SVG's layout size (`clientWidth`/`clientHeight`), so the reveal animation no longer affects framing. The parity harness now injects its animation freeze into the served HTML and fails any shot with a live CSS animation/transition. All 16 baselines were retaken from the fixed Phase 7 build.

Gates (all re-run 2026-10-03 after the fix):
- `npm run build`: green (COSMOS_VERSION=e14ae1d530f1cc30).
- `npm run typecheck`: green.
- `npm run lint`: 0 errors, 1 pre-existing warning (Map.tsx:821).
- `npm test`: client 202 / server 333 / scripts 5, all passing (includes the new `useMapView` fit test).
- `npm run validate`: green.
- `npm run cosmos:check`: 24/24.
- `npm run test:e2e`: 4/4 passed, against `npm run dev` with `BASE_URL=http://localhost:5175` (an unrelated Vite holds 5173/5174). The CI job has not run yet.
- `npm run parity:screens`: **green 16/16 on 4 consecutive runs** (3 with `--skip-build` right after `--update`, 1 with a fresh build after all other gates). The live-animation guard passed on every view.
- Determinism under load: with live animations (no freeze, no fake clock) and CPU throttling ×1/×4/×8, the world transform is identical for `/?scenario=shopping.place-order` (scale 1.42787) and `/` (scale 1.27376).
- Visual check: new vs HEAD baselines for `scenario-shopping.place-order` show the same map at the same 143% zoom; the `default-map` diff image shows only sub-pixel edge/capsule outlines.

Manual checks:
- The error screen was screenshot-checked at 390×844 first, then 1440×900.
- Not verified: the in-browser Retry-recovers flow (a scripted check was denied by permissions; unit and component tests cover it), slow-3G throttling (no blank frame), and the `curl localhost:5173/api/cosmos` fresh-shell check on the default port (verified on :5175 and on :8787 directly).

## Commit message
feat(client): load the cosmos from /api/cosmos behind a loading gate, add no-account dev loop

The map now fetches its data from the server before drawing, so local dev needs the API too: `npm run dev` runs
Vite plus a Hono node dev server with an /api proxy. Retry starts a fresh request after a failure or timeout (I2), and a
Playwright test proves the browser↔server↔map path in CI (A1). The camera fit now measures the map's layout size, so the
reveal animation no longer shifts framing, and the parity harness's animation freeze really applies; all 16 parity
baselines were retaken (owner-approved).

## Key decisions
- New root dev dependencies: `@hono/node-server` ^2.1.3, `concurrently` ^10.0.5, `@playwright/test` ~1.63.0. They are pinned to match the installed `playwright` 1.63.0, and every `engines` range fits `node >=22`.
- `dev-server.ts` loads `.env.local` (root) and then `server/.env` with `process.loadEnvFile`, then dynamically imports the app.
- The Playwright webServer waits on `:5173/api/cosmos` (through the proxy), not bare `:5173`, so tests start only when both processes answer. `BASE_URL` reuses an app that is already running.
- The client guard is a shape check, not Zod: the client has no Zod and the server already validates. It throws a typed `CosmosFetchError` with `COSMOS_TIMEOUT|HTTP_STATUS|NETWORK|MALFORMED_RESPONSE`.
- The load state lives in an extra hook, `client/src/api/useCosmosLoad.ts`. `useCosmos()` throws `NO_COSMOS_PROVIDER` when used outside the provider.
- `WarpTransition` gained a `hold` prop: it cruises while held and finishes the last 15% when released.
- Deep-link hydration now runs when the shell first shows, not on App mount, so render order matches the pre-gate code.
- `useDemoRunner` now starts when its script arrives after mount, because App withholds the script until the data is ready. `useAiConnection` waits for the shell too.
- **Parity harness changed (orchestrator asked how the `/api` 404 stub was handled).** `/api/cosmos` is served with the exact `getCosmosResponseBody()` JSON and registered after the 404 stub so it wins. The shell now mounts whenever the fetch answers, which made the old harness racy, so the harness now:
  - freezes animations from the first paint;
  - pauses the fake clock;
  - waits for `.lc-app`.
- **Parity root cause:** `useMapView.fitTarget` measured `svg.getBoundingClientRect()`, which includes the `.lc-stage` reveal keyframe `scale(1.04 → 1)`, so framing depended on how far the reveal had run (a CPU-speed race in the pre-Phase-7 code too). The harness freeze appended from an init script did not survive document parsing, so animations ran live during shots.
- **Fix (owner-approved):** `fitTarget` uses `clientWidth`/`clientHeight`. That works because the SVG is `position: absolute`, so it has a block layout box. The other `getBoundingClientRect()` calls in `useMapView` map pointer screen coordinates and do not set framing, so they were left alone. The harness serves the freeze `<style>` inside the HTML through a document route and asserts zero live CSS animations before each shot. All 16 baselines were retaken from the Phase 7 build, because both fixes change every view. Cause, fixes and evidence are in the decisions log.
- For Phase 8: every component migration must render inside `CosmosProvider` (the shell only). Re-run `npm run test:e2e` after each row.

## Open questions
- The CI `e2e` job has not run yet.
- These manual acceptance checks are still open:
  - slow-3G throttling shows no blank frame;
  - the in-browser "API down → Retry recovers" flow.
