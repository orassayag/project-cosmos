## Files
package.json
package-lock.json
.gitignore
eslint.config.mjs
client/package.json
index.html
client/index.html
public/favicon.svg
client/public/favicon.svg
src/App.tsx
client/src/App.tsx
src/appVersion.d.ts
client/src/appVersion.d.ts
src/components/ActivityLog.tsx
client/src/components/ActivityLog.tsx
src/components/AskAgent.tsx
client/src/components/AskAgent.tsx
src/components/AskPanel.tsx
client/src/components/AskPanel.tsx
src/components/ChangelogPanel.tsx
client/src/components/ChangelogPanel.tsx
src/components/DomainBar.tsx
client/src/components/DomainBar.tsx
src/components/DriftFooter.tsx
client/src/components/DriftFooter.tsx
src/components/HelpButton.tsx
client/src/components/HelpButton.tsx
src/components/HelpModal.tsx
client/src/components/HelpModal.tsx
src/components/IncidentBanner.tsx
client/src/components/IncidentBanner.tsx
src/components/IncidentBar.tsx
client/src/components/IncidentBar.tsx
src/components/IntroOverlay.tsx
client/src/components/IntroOverlay.tsx
src/components/MobileMenu.tsx
client/src/components/MobileMenu.tsx
src/components/PanelCloseButton.tsx
client/src/components/PanelCloseButton.tsx
src/components/PlaybackControls.tsx
client/src/components/PlaybackControls.tsx
src/components/ScenarioStatus.tsx
client/src/components/ScenarioStatus.tsx
src/components/Spotlight.tsx
client/src/components/Spotlight.tsx
src/components/Starfield.tsx
client/src/components/Starfield.tsx
src/components/StepPanel.tsx
client/src/components/StepPanel.tsx
src/components/TechIcon.tsx
client/src/components/TechIcon.tsx
src/components/WarpTransition.tsx
client/src/components/WarpTransition.tsx
src/components/payload-parser.ts
client/src/components/payload-parser.ts
src/hooks/useDeepLink.ts
client/src/hooks/useDeepLink.ts
src/hooks/useMapView.ts
client/src/hooks/useMapView.ts
src/hooks/useViewport.ts
client/src/hooks/useViewport.ts
src/incidents/data.ts
client/src/incidents/data.ts
src/incidents/hub-silence-2026-07-19.ts
client/src/incidents/hub-silence-2026-07-19.ts
src/incidents/inventory-oversell-2026-05-04.ts
client/src/incidents/inventory-oversell-2026-05-04.ts
src/incidents/payment-cascade-2026-03-12.ts
client/src/incidents/payment-cascade-2026-03-12.ts
src/incidents/types.ts
client/src/incidents/types.ts
src/main.tsx
client/src/main.tsx
src/map/AmbientPackets.tsx
client/src/map/AmbientPackets.tsx
src/map/BlastLegend.tsx
client/src/map/BlastLegend.tsx
src/map/BrandStarfield.tsx
client/src/map/BrandStarfield.tsx
src/map/CometPackets.tsx
client/src/map/CometPackets.tsx
src/map/DriftOverlay.tsx
client/src/map/DriftOverlay.tsx
src/map/Edge.tsx
client/src/map/Edge.tsx
src/map/EngagementCluster.tsx
client/src/map/EngagementCluster.tsx
src/map/FulfillmentCluster.tsx
client/src/map/FulfillmentCluster.tsx
src/map/HealthCard.tsx
client/src/map/HealthCard.tsx
src/map/HealthLegend.tsx
client/src/map/HealthLegend.tsx
src/map/Map.tsx
client/src/map/Map.tsx
src/map/MapStepper.tsx
client/src/map/MapStepper.tsx
src/map/NebulaField.tsx
client/src/map/NebulaField.tsx
src/map/OwnershipLegend.tsx
client/src/map/OwnershipLegend.tsx
src/map/Planet.tsx
client/src/map/Planet.tsx
src/map/ServiceNode.tsx
client/src/map/ServiceNode.tsx
src/map/ServicePanel.tsx
client/src/map/ServicePanel.tsx
src/map/ShoppingCluster.tsx
client/src/map/ShoppingCluster.tsx
src/map/StarExplosion.tsx
client/src/map/StarExplosion.tsx
src/map/SubServicePanel.tsx
client/src/map/SubServicePanel.tsx
src/map/TopicNode.tsx
client/src/map/TopicNode.tsx
src/map/TopicPanel.tsx
client/src/map/TopicPanel.tsx
src/map/UICluster.tsx
client/src/map/UICluster.tsx
src/map/blast-radius.ts
client/src/map/blast-radius.ts
src/map/edge-builder.ts
client/src/map/edge-builder.ts
src/map/edge-registry.ts
client/src/map/edge-registry.ts
src/map/edge-resolver.ts
client/src/map/edge-resolver.ts
src/map/parallaxPan.ts
client/src/map/parallaxPan.ts
src/map/planetMorphology.ts
client/src/map/planetMorphology.ts
src/map/topic-groups.ts
client/src/map/topic-groups.ts
src/overlays/OverlayManager.tsx
client/src/overlays/OverlayManager.tsx
src/scenarios/brand.ts
client/src/scenarios/brand.ts
src/scenarios/data.ts
client/src/scenarios/data.ts
src/scenarios/drift.ts
client/src/scenarios/drift.ts
src/scenarios/health.ts
client/src/scenarios/health.ts
src/scenarios/owners.ts
client/src/scenarios/owners.ts
src/scenarios/runner.ts
client/src/scenarios/runner.ts
src/scenarios/scenarios.ts
client/src/scenarios/scenarios.ts
src/scenarios/services.ts
client/src/scenarios/services.ts
src/scenarios/steps/core.ts
client/src/scenarios/steps/core.ts
src/scenarios/steps/engagement.ts
client/src/scenarios/steps/engagement.ts
src/scenarios/steps/fulfillment.ts
client/src/scenarios/steps/fulfillment.ts
src/scenarios/steps/shopping.ts
client/src/scenarios/steps/shopping.ts
src/scenarios/topics.ts
client/src/scenarios/topics.ts
src/scenarios/types.ts
client/src/scenarios/types.ts
src/styles/app.css
client/src/styles/app.css
src/styles/components.css
client/src/styles/components.css
src/styles/global.css
client/src/styles/global.css
src/styles/responsive.css
client/src/styles/responsive.css
src/styles/tokens.css
client/src/styles/tokens.css
tsconfig.json
client/tsconfig.json
vite.config.ts
client/vite.config.ts

## Summary
The Vite app (`index.html`, `vite.config.ts`, `tsconfig.json`, `public/`, `src/`) now lives in `client/`, moved with `git mv` (86 renames, all shown as `R`). The root `package.json` is now an npm workspaces root (`["client"]`) holding only orchestration scripts and the shared tooling, and the React/Vite dependencies moved into the new `client/package.json`. `client/vite.config.ts` reads the version ledger from `../versions/`, resolved from the config file's own location. `eslint.config.mjs` now targets `client/src` and ignores every `dist/`, and `.gitignore` gained `client/dist/`, `server/dist/` and `**/tsconfig.tsbuildinfo`.

Verification:
- `npm install`: pass. The lockfile was rewritten for the workspace layout.
- `npm run build`: pass (exit 0). Output goes to `client/dist/`, with the existing >500 kB chunk-size warning.
- `npm run lint`: pass (exit 0), with 0 errors and 2 `react-hooks/exhaustive-deps` warnings (`client/src/components/AskPanel.tsx:53`, `client/src/map/Map.tsx:820`). These are not new: the same rule already covered these files at their old `src/` paths.
- `npm run typecheck`: pass (exit 0).
- `npm run validate`: fails as expected until stage 2, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/orassayag/Repos/project-cosmos/src/scenarios/services.js' imported from /Users/orassayag/Repos/project-cosmos/drift-sync/scripts/validate.ts`.
- `npx tsc -p drift-sync --noEmit`: not run. The permission system denied the command in this session, including with the flags reordered. It is expected to fail on the same `../../src/...` imports, so stage 2 should capture the baseline.
- `npm run fresh`: deliberately not run, because it overwrites scenario data and cannot be undone. From reading the code: `scripts/fresh-start.mjs` still resolves `<root>/src/scenarios/`, which no longer exists, so it would fail with ENOENT. Stage 2 repoints it.
- Dev-server smoke: pass. `npm run dev:client` started Vite from `client/`, and both `/` (the Project Cosmos index HTML) and `/src/main.tsx` returned HTTP 200. It came up on :5174, because :5173 was already held by an older root-level `vite` process (PID 23408, `node .../project-cosmos/node_modules/.bin/vite`) that was running before this stage. That old process now returns 404 because `index.html` has moved. I did not kill it, since it is not mine. My own dev server was stopped.

## Commit message
refactor(client): move Vite app into client/ workspace

Prepares the repo for a server workspace next to the SPA (add-ai plan, M0).
Root package.json becomes the npm workspaces root with orchestration scripts only;
app deps move into client/, and vite.config resolves ../versions from its own path.

## Key decisions
- `dev` and `dev:client` both run `npm run dev --workspace client` for now. Stage 6 switches `dev` to `vercel dev` once the `vercel.json` Services config exists.
- `build` and `typecheck` fan out with `--workspaces`, and no gate script uses `--if-present`. When stage 3 adds `server` to `workspaces`, it must give the server its own `build` and `typecheck` scripts, or the fan-out will fail.
- `lint` stays a single root `eslint .`: there is one flat config at the root that already covers every folder, so splitting it per workspace would only duplicate it. The react-hooks block now matches `client/src/**/*.{ts,tsx}`, and the ignore list uses `**/dist/` so `client/dist` and a future `server/dist` are skipped. The `scripts/**` / `drift-sync/**` globals block is unchanged.
- `validate`, all the `sync*` scripts and `fresh` are unchanged at the root.
- `@anthropic-ai/sdk`, `tsx`, `typescript`, `@types/node`, `eslint`, `@eslint/js`, `typescript-eslint` and `eslint-plugin-react-hooks` stay in the root devDependencies. `client/` runs `tsc -b` using the hoisted `typescript`.
- The client workspace package is named `@project-cosmos/client`. Root scripts address it by path (`--workspace client`).
- `client/vite.config.ts` uses `VERSIONS_DIRECTORY = fileURLToPath(new URL('../versions/', import.meta.url))`. This is independent of cwd, so it works for both `npm run build --workspaces` (cwd `client/`) and a direct Vite run.
- The stale, ignored root `dist/` and `tsconfig.tsbuildinfo` were left in place.
- `vercel.json` was not touched. Its build and output settings still assume the root layout until stage 6.

## Open questions
- The stale root Vite dev server on :5173 (PID 23408) should be restarted by the developer, from `npm run dev:client`.
