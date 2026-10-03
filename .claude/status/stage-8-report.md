## Files
README.md
package.json
docs/plans/server-owned-data-decisions.md
scripts/cosmos-check.ts
scripts/dump-cosmos-response.ts
scripts/dump-baseline.ts
scripts/__tests__/cosmosResponseFixture.test.ts
client/src/App.tsx
client/src/api/cosmosIndex.ts
client/src/player/runner.ts
client/src/scenarios/runner.ts
client/src/theme/statusMeta.ts
client/src/theme/driftRuns.ts
client/src/hooks/useDeepLink.ts
client/src/overlays/OverlayManager.tsx
client/src/styles/app.css
client/src/components/ActivityLog.tsx
client/src/components/AskPanel.tsx
client/src/components/askStream.ts
client/src/components/ChangelogPanel.tsx
client/src/components/DomainBar.tsx
client/src/components/DriftFooter.tsx
client/src/components/HelpModal.tsx
client/src/components/IncidentBanner.tsx
client/src/components/IncidentBar.tsx
client/src/components/IntroOverlay.tsx
client/src/components/PlaybackControls.tsx
client/src/components/ScenarioStatus.tsx
client/src/components/Spotlight.tsx
client/src/components/StepPanel.tsx
client/src/components/TechIcon.tsx
client/src/map/AmbientPackets.tsx
client/src/map/BlastLegend.tsx
client/src/map/ClusterBackdrop.tsx
client/src/map/CometPackets.tsx
client/src/map/DriftOverlay.tsx
client/src/map/Edge.tsx
client/src/map/HealthCard.tsx
client/src/map/HealthLegend.tsx
client/src/map/Map.tsx
client/src/map/NebulaField.tsx
client/src/map/OwnershipLegend.tsx
client/src/map/Planet.tsx
client/src/map/ServiceNode.tsx
client/src/map/ServicePanel.tsx
client/src/map/SubServicePanel.tsx
client/src/map/TopicNode.tsx
client/src/map/TopicPanel.tsx
client/src/map/blast-radius.ts
client/src/map/ecosystem.ts
client/src/map/edge-builder.ts
client/src/map/edge-resolver.ts
client/src/map/topic-groups.ts
client/src/map/topicGroupLayout.ts
client/src/map/__tests__/clusters.test.tsx
client/src/__tests__/askMapActions.test.tsx
client/src/__tests__/askUnknownAction.test.ts
client/src/__tests__/loadingGate.test.tsx
client/src/__tests__/renderWithCosmos.tsx
client/src/__tests__/fixtures/cosmos-response.json
client/src/demo/__tests__/demoMode.test.ts
client/src/demo/__tests__/demoTargets.test.tsx
client/src/demo/__tests__/scriptedAnswer.test.ts
client/src/demo/__tests__/scripts.test.ts

## Summary
Every client feature now renders from the `/api/cosmos` response: components read `useCosmos()` / `useCosmosIndex()` (id lookups only), the runner and deep links take the loaded response, and the module-load derivations (`DEPENDENTS_OF`, `TOPIC_GROUPS`, `CONNECTED_NODE_IDS`, the edge list, client drift search) are deleted in favour of `derived.*`; only geometry and presentation tables stay client-side (`client/src/theme/`). The five Phase 6 Ask map actions now run: each opens its view above the answer (phones: the existing one-panel stack; desktop: the answer is kept beneath instead of being aborted), `openPassport` opens beside the answer on desktop, and `openChangelogEntry` pages to and marks the entry. Tests run on a fixture generated from the real route (`npm run fixture:cosmos`, freshness test in `npm test`) through `renderWithCosmos`, with a new component-level `askMapActions.test.tsx` (9 tests: each action on a phone viewport, unknown id, two desktop cases).

Gates (verified, run by me): `npm run build` ✅ (COSMOS_VERSION e14ae1d530f1cc30; the >500 kB chunk warning is pre-existing — the bundle still carries the old data via `demo/scripts.ts` until Phase 9) · `npm run typecheck` ✅ · `npm run lint` ✅ 0 errors, 1 pre-existing warning (`Map.tsx:834`, was :821) · `npm test` ✅ client 214/214 (24 files), server 333/333, scripts 6/6 · `npm run validate` ✅ 0 errors · `npm run cosmos:check -- --phase 8` ✅ 27/27 (phases 0–8) · `npm run parity:screens` ✅ 16/16 twice (fresh build + `--skip-build`; max 79 px = 0.0038%, counts vary between runs = comet noise) · `npm run test:e2e` ✅ 4/4 with `BASE_URL=http://localhost:5175` (5173/5174 held by unrelated Vite) · demo limits ✅ via `scripts.test.ts` (now on the fixture). Not verified: per-row `parity:screens`/`test:e2e` runs (the rows were migrated in one pass and checked together, twice); a real-browser look at the Ask actions on a phone (covered only by the jsdom component test — the actions need a live agent); `demo=ai`/`demo=all` re-recording (tours unchanged).

## Commit message
feat(client): render every feature from /api/cosmos and run the Ask map actions

Phase 8 of the server-owned-data migration: components read the loaded response
instead of the client data copy, module-load derivations give way to `derived`,
and the agent's blast/passport/health/ownership/changelog actions now open their
views above the answer. Tests use a fixture written from the real route.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

## Key decisions
- **Data access:** `client/src/api/cosmosIndex.ts` (`indexCosmos` cached per response, `useCosmosIndex`, `stepsFor`, `nodeKindOf`, `nodeName`). `App` is above the provider, so it indexes the ready response from `useCosmosLoad()` directly. Runner moved to `client/src/player/runner.ts` as `useScenarioRunner(response | null)`; `resolvePlayableId(id, index)`; `useDeepLink` takes `defaultDomainId`; active domain is `null` until picked and resolves to `data.domains[0]`.
- **Deleted:** `client/src/map/topic-groups.ts` (→ `topicGroupLayout.ts`, ring geometry over `derived.topicGroups`), `client/src/map/blast-radius.ts` (→ `derived.blastRadius`, presentation in `theme/statusMeta.ts`), `client/src/scenarios/runner.ts` (moved), `scripts/dump-baseline.ts` + `npm run baseline:dump` (imported the deleted derivations; baseline fixtures stay frozen). `deriveEdges` → `buildEdges(derived.edges, …)`; verified once that server edge order equals the old client order and no hop was skipped, so curve sides are unchanged.
- **Kept client-side on purpose (no visible change):** Map's `TOPICS_TOUCHING_SERVICE` (differs from `serviceLinks` for `through` receivers) and home bbox → `useMemo` on `version`; `TopicPanel` lists from `data.steps` (`topicLinks` is sorted and would reorder two topics); Spotlight does not add incidents (would change results); `driftEntriesByRun` stays as presentation.
- **Ask actions:** `OverlayManager.open(id, { keepBeneath: true })` stacks above on desktop too; `Map` takes `blastRequest`/`onBlastRequestConsumed`; `SpotlightTarget.keepAsk` puts the inspector on the right (`lc-map-panel--right`) on desktop; `ChangelogPanel` takes `focus: { entryId, requestId }` and marks the entry (`aria-current`, new `.lc-changelog-item--focused` rule). Unknown ids/kinds stay no-ops (`askUnknownAction.test.ts` rewritten: the five kinds parse, malformed/unknown ones don't).
- **IntroOverlay** shows before data loads, so `tagline` is a prop (empty until the response arrives).
- **cosmos:check phase 8** (3 checks) excludes `client/src/demo/` like the Phase 2 grep: `demo/scripts.ts` still imports old data until Phase 9. The client parity twin and `scenarios/palette.ts`'s `paletteVar` remain until Phase 11.
- **For later stages:** fixture must be regenerated with `npm run fixture:cosmos` after any data change (Phase 9 adds `data.demo`/`source`). Phase 9: rewrite `demo/scripts.ts` to `data.demo` and drop the demo exclusion. Phase 12: CLAUDE.md "Layout" still describes `client/src/scenarios/` as the place for changes. File count ≈ 64 (over the 10-file ceiling; most edits are import swaps); `Map.tsx` and `App.tsx` were already over 400 lines.

## Open questions
- Written to `.claude/status/stage-8-blocker.md` (non-blocking; all Phase 8 work is done): (1) should `demo=ai` show one of the new actions now (CLAUDE.md invariant) or wait for the Phase 9 tour rewrite — any surface action fired at typing start covers the answer; (2) keep the chosen desktop behaviour (view opens above the answer, which returns on close), or show views beside the answer / defer them until the answer finishes?
