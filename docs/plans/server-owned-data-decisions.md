# Server-owned data migration — decisions log

Companion to [`server-owned-data-migration-plan.md`](server-owned-data-migration-plan.md). Each entry records an
ambiguity, the smaller change chosen, and why. Newest phase last.

## Phase 0 — Baseline and parity oracle (2026-10-02)

### Baseline gates

The plan says to run the gates on `main`. Phase 0 ran inside a `/master` stage that may not switch branches or
create worktrees, so the gates ran on **`feature/add-ai` at HEAD `0dc2b6e`** instead. That branch is the one
the migration builds on, so it is the baseline that matters.

| Gate | Result |
| --- | --- |
| `npm run build` | ✅ pass |
| `npm test` | ✅ client 140/140 (17 files), server 103/103 (13 files) |
| `npm run validate` | ✅ 0 errors, 0 warnings (12 services, 8 topics, 40 steps, 5 scenarios) |
| `npm run lint` | ✅ 0 errors, 1 warning (pre-existing `react-hooks/exhaustive-deps`, `client/src/map/Map.tsx:814`) |

**Caveat — that lint result was not really green.** It came from a stale local `node_modules` that still had
TypeScript 6. Commit `a86f10b` ("Update outdated packages") pinned `typescript` `^7.0.2`. typescript-eslint
8.71.0 supports only `<6.1.0`, so:

- `npm ci` fails with ERESOLVE. CI "Validate Project Cosmos" has been red on `main` since `a86f10b` (2026-10-01; for example, run 36961974815).
- Once local `node_modules` matches the lock, `npm run lint` crashes with "typescript-eslint does not support TS 7.0".

### TypeScript pinned to `^6.0.3` (owner decision)

The owner chose to pin `typescript` back to `^6.0.3` in the root `package.json` (the only `package.json` that
declares it). `package-lock.json` was regenerated with a plain `npm install`, with no `--legacy-peer-deps`.

- Reason: typescript-eslint 8.71 supports TypeScript `>=4.8.4 <6.1.0`. With TS 7, `npm ci` fails and lint crashes.
- Verified on the honest install: `npm ci` succeeds, `node_modules/typescript` is 6.0.3, and `npm ls typescript`
  shows a single deduped 6.0.3. Build, typecheck, lint (0 errors, the same 1 warning), test, validate,
  `cosmos:check --phase 0` and `parity:screens` all pass.
- **Revisit** when a typescript-eslint release supports TypeScript 7. Then bump both together and re-run the gates.

### Drift Sync pause (I5)

- Before the change, `gh variable get DRIFT_SYNC_ENABLED` returned "variable not found". The job condition
  `vars.DRIFT_SYNC_ENABLED == 'true'` was therefore already false, so the workflow was effectively off.
- Ran `gh variable set DRIFT_SYNC_ENABLED --body false`. `gh variable get DRIFT_SYNC_ENABLED` now prints `false`.
- To undo this in Phase 10, set the variable to `true`. Deleting it again would also keep the workflow off.
- `gh pr list --search "head:drift-sync" --state open` returned none, and `gh pr list --state open` returned none.
  No Drift Sync PR needed a decision, so the baseline includes every merged change and nothing pending.

### Baseline fixtures

- `npm run baseline:dump` (`scripts/dump-baseline.ts`) writes `server/src/__tests__/fixtures/baseline-full.json`.
  It has two parts:
  - `data`: every client data export, steps with payloads, and per-scenario steps.
  - `derived`: the derived values.
- It also copies `server/src/generated/cosmos-map.json` to `baseline-cosmos-map.json`.
- `DEPENDENTS_OF` is module-private in `client/src/map/blast-radius.ts`. Exporting it would be a product change,
  so the dump rebuilds it from `computeBlastRadius(id)`, taking the 1-hop dependents. It also stores the full blast
  result for every node as `BLAST_RADIUS`, which is a stronger oracle.
- Maps and Sets are serialized in insertion order: a Map becomes an object, a Set becomes an array. The edge list is
  `deriveEdges()` with no layout overrides.

### Screenshot oracle (A2)

`npm run parity:screens` builds the client, serves it with `vite preview` on port 4317, and stops the server when it
finishes. It captures 16 views:

- the default map
- 5 scenarios mid-play
- 3 incidents mid-play
- blast radius on `payments`
- health view
- ownership view
- drift overlay
- changelog open
- `realtime-hub` selected
- a 390×844 phone view of the default map

How the views are kept deterministic:

- Playwright `page.clock` freezes time, and JS animations are advanced with `runFor`.
- `Math.random` is seeded.
- CSS transitions and keyframes are disabled, so every shot shows the settled end state.
- `/api/**` gets a stubbed 404.
- The version badge is masked, because it changes with every commit.
- **Web fonts are blocked.** Google Fonts arrive at an unpredictable moment relative to the first camera fit, which
  measures the layout. When they arrived at different times, scenario and incident views came out at two camera
  scales (for example 1.2618 vs 1.2602), giving about 0.1–0.28% pixel differences. Shots use fallback fonts. This
  makes the oracle stable and offline-safe, but the baselines do not show the production typeface.
  **The owner accepted fallback fonts in the parity baselines** (2026-10-02). No code change.

Two views differ from the plan's list:

- **Mid-play via Next, not `?step=`.** A `?scenario=…&step=N` deep link landed on step 1 in this build. Mid-play is
  reached by pressing the real Next control until the middle step. The deep-link step bug is recorded but not fixed
  (product code).
- **`realtime-hub` expanded is unreachable.** `expandedServiceId` is a constant `null` (`client/src/map/Map.tsx:174`),
  so the expanded ecosystem cannot be opened in the UI. The view used instead is `realtime-hub-selected`: clicking the
  hub opens its inspector, which is the closest real view.

**Threshold: keep 0.1%.**

- After `--update`, two plain runs both passed 16/16. The worst view was 41 px (0.0020%), and most views were 0–25 px.
- Nudge check: payments `x` 1560 → 1580 failed `default-map` (0.1555%) and `health-view` (0.1915%). The command
  exited 1 and named both views.
- The nudge was reverted, and `git diff -- client/` is empty.
- Limitation: on the phone view the same 20 px nudge measured only 0.0459%, under the threshold, because the whole
  world is drawn small there. Small position changes are caught by the desktop views.

### Bundle size and first paint (`vite preview`, local, 2026-10-02)

| Metric | Value |
| --- | --- |
| JS `index-*.js` | 666,249 B raw / 213,087 B gzip |
| CSS `index-*.css` | 128,952 B raw / 20,640 B gzip |
| `client/dist` total | 1.3 MB |
| First contentful paint (median of 5) | 336 ms |
| First service node in DOM (median of 5, intro skipped) | 403 ms |

These were measured on a 1920×1080 headless Chromium with real time and fonts from the network. They are a reference
point for Phase 13, not a CI gate.

### Known issues (pre-existing, not fixed in Phase 0)

- `drift-sync/scripts/validate.ts` has no checks for:
  - `phaseId` uniqueness
  - capsule spacing (≥150px)
  - service `hex` against its `color` token
  - incident steps

  `CLAUDE.md` lists all of these as invariants. Phase 1's `validateCosmos()` must cover them.
- `client/src/scenarios/steps/core.ts` (`CORE_STEPS`) is an unused leftover from `npm run fresh`. Nothing imports it;
  only `scripts/fresh-start.mjs` writes it.
- `client/src/scenarios/drift.ts` and `health.ts` are hand-written fictional fixtures, not produced by any pipeline.
- The `?step=` deep link does not land on the requested step (see above).
- CI and `npm ci` were broken by the TypeScript 7 / typescript-eslint mismatch. This is fixed by the TypeScript 6 pin
  (see Baseline gates).
- The new root `scripts/*.ts` files are not covered by any tsconfig. They run under `tsx` and are linted, but they
  have not been type-checked.

### Progress report (A3)

`npm run cosmos:check [-- --phase <n>]` (`scripts/cosmos-check.ts`) runs a table of checks. Each check carries the
phase that activates it. There are three kinds of check:

- `files-exist`
- `grep-absent`
- `grep-present`

Both grep kinds use `git grep --untracked`, so new uncommitted files count. Later phases append their entries to
`COSMOS_CHECKS`. The unit tests in `scripts/__tests__/cosmosCheck.test.ts` run under `npm run test:scripts`, which is
now part of `npm test`.

## Phase 1 — Move the data into the server (2026-10-02)

### What `getCosmosData()` holds

- `server/src/cosmos/index.ts` returns one lazily built, deeply frozen `CosmosData` object:
  `brand`, `domains`, `services`, `topics`, `scenarios`, `steps`, `incidents`,
  `owners { teams, fallback, serviceOverrides }`, `drift { runTimeUtc, entries }` and
  `health { asOf, services, onCallByTeam }`. Keys are camelCase and grouped the way the Phase 4 response groups them.
- **Facts only.** Presentation metadata stays on the client for now: `DRIFT_KIND_META`, `HEALTH_STATUS_META`
  (color tokens, glyphs, blurbs) and `INCIDENT_COMET_HEX`. They describe how the UI draws a value, not the system.
  If a later phase needs them on the server, it adds them then.
- Lookup tables and derived values are not copied: `*_BY_ID`, `PLAYABLE_BY_ID`, `ALL_STEPS`, `INCIDENT_STEPS`,
  `LATEST_DRIFT_*`, `KIND_SEVERITY`, `HEALTH_BY_SERVICE`, `HEALTH_STATUS_COUNTS` and every helper belong to Phase 3.
  `steps/core.ts` is not copied.
- The incident list keeps the client's newest-first `sort` so the order matches the baseline.
- `color` is unchanged. The brand file's "`npm run fresh` rewrites this file" note was dropped from the server copy,
  because `fresh` only writes the client copy.

### Types and schemas

- `apiTypes.ts` has no imports and no runtime code (I3). `types.ts` re-exports it with `export type *` and adds the
  server-only `CosmosValidationIssue`.
- `Service.team` and `DriftEntry.team` use a named `TeamId` union instead of the client's
  `NonNullable<Service['team']>`. The values are the same.
- `schema.ts` uses `z.strictObject`, so an unknown field fails the parse. Every schema ends in
  `satisfies z.ZodType<T>`. Limitation: `satisfies` catches a schema field that the type lacks or types differently,
  but not an **optional** type field the schema omits. Phase 5's `CosmosResponseSchema` has the same gap.
- `zod` was already a server dependency (`^4.6.5`). No package change.

### `validateCosmos()`

Returns `{ errors, warnings }`, each issue with a named `code`. Ported from `drift-sync/scripts/validate.ts`:
`unknown-phase`, `unknown-step-from`, `unknown-step-to`, `unknown-step-through`, `kafka-step-missing-via`,
`unknown-step-via`, and the `service-no-owner` warning. Added: `duplicate-node-id`, `duplicate-playable-id`,
`duplicate-phase-id` (scenarios and incidents together), `incident-step-phase-mismatch`, `capsules-too-close`,
`out-of-world`, `unknown-scenario-domain`, `unknown-team`, `unknown-drift-node`, `unknown-health-service`.
Incident steps run through the same step checks, with `incidentId` in the context.

- **Capsules means services only.** Topic nodes are not capsules: `shipping` and `inventory.back-in-stock` are 148px
  apart today. Checking topics would fail on unchanged data.
- **Reference rules kept from the old validator:** `from`/`to` resolve to a service, sub-service or topic; `through`
  to a service or sub-service; `via` to a topic.
- **Not ported:**
  - Snapshot freshness. It compares a file on disk, and the snapshot goes away in Phase 11.
  - The source-repo greps. They need cloned repos and stay in `drift-sync`.
  - Service `hex` against its `color` token. That needs `client/src/styles/tokens.css`, which the server may not
    read. Phase 2 (`palette`) replaces it.

### Parity

- `server/src/__tests__/cosmosParity.test.ts` and its twin `client/src/__tests__/cosmosParity.test.ts` deep-equal
  (JSON round trip, `toStrictEqual`) the raw-data keys of `baseline-full.json`: `BRAND`, `DOMAINS`, `SERVICES`,
  `TOPICS`, `SCENARIOS`, `STEPS`, `INCIDENTS`, `TEAM_OWNERS`, `FALLBACK_OWNER`, `DRIFT_ENTRIES`, `SERVICE_HEALTH`,
  `HEALTH_AS_OF`. `STEPS_BY_SCENARIO` and `LATEST_DRIFT_*` are derived values, so their parity is checked in Phase 3.
  `SERVICE_OVERRIDES`, `ON_CALL_BY_TEAM` and `DRIFT_RUN_TIME_UTC` are not in the Phase 0 fixture, so the parity tests
  cannot check them. They were copied by hand.

### A3 check scope

The `phase 1` check greps `server/src`, not all of `server/`. `server/scripts/snapshot-map.ts` still imports the
client copy to write `cosmos-map.json`. It is existing tooling that Phase 11 deletes, so changing it now would only
add risk.

## Phase 2 — Move hardcoded domain knowledge into data (2026-10-02)

### New data fields

Both copies (server `server/src/cosmos/data/`, client `client/src/scenarios/`) got the same change, so both parity
tests still pass.

| Field | Where | Replaces |
| --- | --- | --- |
| `palette: PaletteKey` | `Service` (replaces `color`) | `color: 'var(--svc-…)'` |
| `palette: Record<PaletteKey, hex>` | `CosmosData` (`data/palette.ts`, client `scenarios/palette.ts`) | — |
| `clusters: Cluster[]` with `id`, `label`, `serviceIds`, `nebula { anchorServiceIds, base, hot }` | `CosmosData` (`data/clusters.ts`) | the four `*Cluster.tsx` id lists and `REGION_SPECS` in `NebulaField.tsx` |
| `ecosystem { expandable, intakeTopicId, intakeSubServiceId, internalEdges, egressSubServiceId }` | `Service` (only `realtime-hub`) | `realtime-hub` / `hub-*` special cases in `Map.tsx` and `edge-resolver.ts` |
| `groupServiceId` (required) | `Topic` | the name-prefix rule, the `hub`→`realtime-hub` alias and the first-producer fallback in `topic-groups.ts` |

### Palette

- **`PaletteKey` has 13 keys, not 14.** `tokens.css` also defines `--svc-yellow`, but no data uses it and there is no
  existing hex for it. Adding it would mean inventing a hex, so it is left out. A future service that wants yellow adds
  the key and its hex together.
- **`violet` (`#a78bfa`) has no service.** It is in the table because the UI nebula's "hot" hue uses it. The hex is
  the value `NebulaField.tsx` already had.
- **The palette table is data, not presentation.** It maps a key to the concrete hex that `Service.hex` already
  records. That lets `validateCosmos()` replace the hex↔color-token check Phase 1 could not port:
  `service-hex-mismatch` fires when `service.hex !== palette[service.palette]`. `PaletteKeySchema` rejects unknown
  keys, and the `palette` record must list every key.
- The client maps a key to CSS with `paletteVar(key)` → `var(--svc-<key>)`. `tokens.css` stays client-owned. A client
  test checks that every palette key has a `--svc-<key>` token in `tokens.css`.
- **Only services moved to `palette`.** Topics, scenarios, team owners, drift and health metadata keep their `color`.
  The plan's table names only `services.ts`; changing the others would change more fixture values than I4 allows.

### Clusters and nebula

- The four `*Cluster.tsx` files were replaced by one `ClusterBackdrop.tsx` that takes a `Cluster` and a service lookup
  as props (so the component test can pass fixture data with a renamed member).
- **Geometry and styling stay client-side, keyed by cluster id** (padding, gradient stops, stroke, watermark fill), as
  the plan's table says ("plus hardcoded geometry/styling"). They are presentation, matching Phase 1's "facts only" rule.
  The values are not derivable from the palette (for example the UI stroke `rgba(140, 200, 255, 0.18)`). A cluster id
  with no hand-tuned style gets one built from its nebula hues.
- `label` is stored in title case (`'Shopping'`) and upper-cased at render, so the watermark text and its size are
  unchanged.
- `nebula.anchorServiceIds` equals `serviceIds` for all four clusters today. Both are kept because the plan lists
  anchor ids on the nebula; validation checks both resolve (`unknown-cluster-service`).
- Array order is paint order and the nebula's drift-phase order (`i * -6s`), so `CLUSTERS` keeps the old order
  ui → shopping → fulfillment → engagement.

### Ecosystem

- The plan's two fields (`expandable`, `internalEdges`) are not enough to rebuild the routes without naming ids, so the
  ecosystem also records `intakeTopicId` (`hub-broadcasts`), `intakeSubServiceId` (`hub-ingest`) and
  `egressSubServiceId` (`hub-push`). `internalEdges` holds the three sub-service hops in travel order.
- The sub-services that light up during a scenario (formerly the literal ingest/presence/push set) are derived: intake
  + every internal-edge endpoint + egress. `hub-router` is still left out.
- Edge bends inside the ecosystem are geometry, so they are derived client-side (a hop with a return hop bows 1, its
  return −1, others 0), which reproduces the old hand-written values.
- `ServiceNode` shows the ecosystem only when `ecosystem.expandable` is true and sub-services exist.
- **None of this is visible today.** `expandedServiceId` is still the constant `null` (Phase 0 note), so the expanded
  path cannot be reached in the UI. The refactor was checked by reading, not by a screenshot.

### No `role` field (the `storefront` special case)

- `Service.role` already exists (the panel subtitle, e.g. "Customer-facing web store"), so the plan's example
  `role: 'entry'` would clash with it.
- The only `storefront` special case was the ecosystem's outbound WebSocket edge. Its destination is now derived from
  the steps: the `to` of every step that goes `through` the service (today only `storefront`). With a scenario active
  it uses that scenario's steps, as before. No new field was needed, so none was added.

### Topic groups

- Each topic's `groupServiceId` is the owner the old rule produced: `orders.*`→orders, `payments.*`→payments,
  `inventory.*`→inventory, `shipping.*`→shipping, `hub-broadcasts`→realtime-hub.
- It is required. A new topic must name its group; there is no prefix guess or first-producer fallback any more.
  `unknown-topic-group` fires when it names an unknown service.

### Fixture changes (I4)

- `baseline-full.phase0.json` is a byte copy of the Phase 0 `baseline-full.json`.
- `baseline-full.json` was regenerated with `npm run baseline:dump`, which now also writes `PALETTE` and `CLUSTERS`.
- Diff review (scripted): after removing `PALETTE`, `CLUSTERS`, service `palette`/`ecosystem`, topic `groupServiceId`
  (in `TOPICS`, `TOPIC_GROUPS` members and everywhere else) and the old service `color`, the two fixtures are
  deep-equal. Every derived value (`EDGES`, `BLAST_RADIUS`, `DEPENDENTS_OF`, `TOPIC_GROUPS`, `CONNECTED_NODE_IDS`,
  `TEAM_GROUPS`, `HEALTH_BY_SERVICE`) is unchanged apart from that. `baseline-cosmos-map.json` is unchanged.

### A3 check scope

The `phase 2` check runs the plan's grep pattern with `git grep` over `client/src/**/*.ts(x)`, excluding
`client/src/scenarios`, `client/src/incidents`, `client/src/demo` and every `__tests__` folder. Comments count too, so
two comments that named services (`HealthCard.tsx`, `SubServicePanel.tsx`) were reworded.

### Docs touched because they became wrong

- `.claude/skills/add-service/SKILL.md`: `palette` instead of `color`, clusters instead of `UICluster.tsx`, the
  `ecosystem` field, and `groupServiceId` on topics. It still does not mention the server copy (a Phase 1 gap).
- `CLAUDE.md`: the hex invariant now reads `hex === PALETTE[palette]`.
- `scripts/fresh-start.mjs`: its two template services use `palette`.

## Phase 3 — Move derived logic to the server (2026-10-02)

### Shape

- Each `server/src/cosmos/derive/*.ts` module exports pure functions that take the data (or the slice they need) as an
  argument. None imports `data/` or `index.ts`; only `view.ts` wires them to `getCosmosData()`. A `phase 3`
  cosmos:check entry enforces this.
- `getCosmosView()` returns `{ data, derived }`. `data` is the same frozen object `getCosmosData()` returns; `derived`
  is built once and deep-frozen (`deepFreeze` is now exported from `index.ts`).
- Every derived type (`CosmosDerived`, `CosmosView` and the types they reference) lives in `apiTypes.ts`, which stays
  import-free, so Phase 5 can copy it as is.
- `derived` keys: `edges`, `connectedNodeIds`, `serviceLinks`, `topicLinks`, `dependentsOf`, `blastRadius`,
  `ownership { byService, teamGroups }`, `topicGroups`, `healthStatus { byService, counts }`,
  `latestDrift { date, entries, byNode }`, `driftSearchText`, `driftLinks`, `playable { items, stepsById }`.
  This is the plan's Phase 4 `derived` list plus `serviceLinks`/`topicLinks` (the snapshot's `calls`/`publishes`/
  `consumes`/`producers`/`consumers`, which the plan puts in `graph.ts`), `dependentsOf` and `driftLinks`.
- Maps and sets became plain records and arrays, so the view serializes as JSON without conversion.

### Split rule applied

- **Edges are logical only:** `{ key, type, from, to }`. The SVG path `d` is geometry and stays in `edge-builder.ts`.
  Order and the rule that drops a hop to a non-service, non-topic id (a sub-service) match `deriveEdges()`.
- **Topic groups are `{ id, serviceId, memberIds }`.** `cx`/`cy` repeat the service position and `ringRadius` is ring
  geometry, so both stay client-side; `members` are recoverable from `topics` by id.
- `BLAST_LEVEL_META`, `HEALTH_STATUS_META` and `DRIFT_KIND_META` stay on the client (presentation, as in Phase 1).
- Not ported (presentation or client-only): `driftRunDateTime` (locale formatting), `driftEntriesByRun`,
  `radialMemberPosition`, `activeNodeSet`/`shotNodeSet`, `scenariosForDomain`. Phase 8 decides if any is needed.

### Behavior notes

- **Drift search uses the kind id, not its label.** The client haystack includes `DRIFT_KIND_META[kind].label`
  (`Added`, `Changed`, `Risk`, `Removed`). Lower-cased, each label equals its kind id, and the haystack is lower-cased,
  so using `entry.kind` keeps matching identical without moving presentation metadata to the server. A cross-check
  script against the client's `driftEntryMatches` could not be run in this session (ad-hoc `tsx` was not allowed);
  the equivalence rests on that argument plus the facet-by-facet unit tests.
- **Graph sources differ on purpose, as on the client:** edges read scenario + incident steps (`ALL_STEPS`);
  `connectedNodeIds`, the dependency graph and `serviceLinks` read scenario steps only.
- `resolveHealth` for a service id that is not in `services` uses `owners.fallback.label`; the client hard-coded the
  same string.
- `stepsFor(id)` returns `[]` for an unknown id (the runner treats it as no scenario).
- `playable.stepsById` repeats steps already in `data.steps` / `data.incidents`. Phase 4 measures gzip size (I7);
  if it is tight, drop `stepsById` from the payload and keep `stepsFor` as a function.

### Tests

- There were no client unit tests for these helpers to port (the client has only the parity twin for this data).
  New unit tests in `server/src/cosmos/derive/__tests__/` run against a small fixture (`cosmosFixture.ts`) built on
  a clone of the real data with services, topics, steps and incidents replaced.
- `cosmosParity.test.ts` now also checks, against `baseline-full.json`: blast radius and 1-hop dependents for every
  service and topic (dependents compared as sets — the baseline lists them in blast-radius order), edges without `d`,
  `CONNECTED_NODE_IDS`, `TOPIC_GROUPS` without geometry, `TEAM_GROUPS`, `HEALTH_BY_SERVICE` per service plus status
  counts, `LATEST_DRIFT_*`, `STEPS_BY_SCENARIO` and incident steps. Against `baseline-cosmos-map.json`: per-service
  `calls`/`publishes`/`consumes`/`domains`/`ownerLabel` and per-topic `producers`/`consumers`.
- No fixture was regenerated and no data value changed.

## Phases 4 and 5 — The cosmos API route and the client API types (2026-10-02)

### Response shape

- `GET /api/cosmos` returns `{ version, data, derived }`, where `data` and `derived` are exactly `getCosmosView()`.
  No data was invented to match the plan's key list:
  - `data` has `palette` and `steps` beyond the plan's list (both added in Phases 1–2), and has `clusters`.
    `data.demo` is **missing** — it arrives in Phase 9.
  - `derived` has `serviceLinks`, `topicLinks`, `dependentsOf` and `driftLinks` beyond the plan's list (Phase 3).
- `version` = first 16 hex chars of the sha256 of `JSON.stringify(view)`. The view and the serialized body are built
  once per process (`getCosmosResponseBody()` in `view.ts`); `getCosmosVersion()` reads the same memo.
- `CosmosResponse` (in `apiTypes.ts`) is `CosmosView & { version: string }`.

### Size (I7)

- Gzipped body: **35,290 bytes (~34.5 KB)**, measured with `zlib.gzipSync` on the exact body the route sends.
  Under the 100 KB limit with room to spare, so `playable.stepsById` stays in the payload.
- `cosmosRoute.test.ts` asserts the ≤100 KB budget, so a data change that crosses it fails `npm test`.

### HTTP contract

- `ETag: "<version>"` and `Cache-Control: public, max-age=60, s-maxage=31536000, stale-while-revalidate=86400` are
  sent on both the 200 and the 304.
- `If-None-Match` matching is a comma-separated list, ignores a `W/` prefix and accepts `*` (RFC 9110 weak comparison).
  Hono's `etag` middleware was not used: it hashes the body per request, while the version is already known.
- The route returns the pre-serialized string with `Content-Type: application/json; charset=UTF-8`.

### AI isolation

- Only `answerQuestion` (`./agent/askAnswer.js`) pulled LangChain, LangGraph, `ai` and the provider SDKs into
  `app.ts`. It is now `await import()`ed inside `POST /ai/ask`, after cookie and body checks — so the import only
  runs for a connected visitor with a valid question. A load failure there reaches `onError` (500 `INTERNAL_ERROR`).
- `checkProviderKey`, `config`, `cookieCrypto` and the request schemas stay static: they use `fetch`, `node:crypto`,
  Hono and Zod only.
- `generated/cosmos-map.json` is still imported statically for the agent's snapshot (it is plain JSON, not the AI
  stack). Phase 11 replaces it with the view.
- `cosmosIsolation.test.ts` mocks `askAnswer`, `graph`, `classify`, `chatModelFactory`, `@langchain/*` and `ai` with
  factories that throw, then imports `app.ts`; `GET /api/cosmos` still answers 200.

### Build version (I6)

- `server/scripts/print-cosmos-version.ts` runs at the end of the server workspace `build` script and prints
  `COSMOS_VERSION=<version>`. Local build at this stage: `COSMOS_VERSION=8dd1bb04e4445ec8`.
- Verified locally that a data change changes the version: temporarily editing `brand.helpTitle` printed
  `03999d8489c264ac`; reverting restored `8dd1bb04e4445ec8`.
- **Not verified:** that Vercel Services runs the server workspace's `build` script (and so prints the line) in a
  deployment build. Check the first preview build log.

### Not done here (no deploy from this stage)

- Preview checks — second request `x-vercel-cache: HIT`, and a second preview from a data change serving the new
  `version` — need a Vercel deploy. They are left as manual checks for the owner.
- Cold-start timing after the lazy import was not measured (needs a preview).

### Client types (Phase 5)

- `server/scripts/emit-client-types.ts` (root `npm run types:emit`, run with `tsx`) rejects any line that starts with
  `import` or `export … from`, then writes the header + the source byte for byte to `client/src/api/cosmos-api.ts`.
  A comment that mentions "imports" is allowed (only line starts are checked).
- CI (`validate-on-pr.yml`) runs `npm run types:emit` then `git diff --exit-code client/src/api/cosmos-api.ts`, right
  after lint. `emitClientTypes.test.ts` also checks that the committed copy equals a fresh emit, so a stale copy
  fails `npm test` locally too. The `git diff` check only bites once `cosmos-api.ts` is tracked (it is new in this
  change set).
- `CosmosResponseSchema satisfies z.ZodType<CosmosResponse>` in `schema.ts`, with a strict schema for every
  derived type. Same known gap as Phase 1: an optional type field that the schema omits is not a compile error.
- One `apiTypes.ts` comment named `realtime-hub` as an example. The copy lands in `client/src/`, where the Phase 2
  grep forbids AstroMart names, so the comment now describes the role instead.
- **Client runtime guard deferred to Phase 7.** The client has no fetch layer yet, and this stage must not wire the
  client to fetch. Phase 7 adds the guard (`version` is a string; every top-level `data`/`derived` key exists) inside
  the fetch layer it creates. `cosmos-api.ts` is type-checked by the client build but imported by nothing yet, so
  the map is unchanged.

### Checks

- `cosmos:check` phase 4: route tests and version script exist; `/cosmos` route registered; no static import of
  the agent, LangChain or provider SDKs in `app.ts`; server build calls `print-cosmos-version`.
- `cosmos:check` phase 5: emitter, its test and the client copy exist; `apiTypes.ts` imports nothing; the
  `satisfies` line exists; the CI diff step exists.
