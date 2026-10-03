# Stage 7 work brief — P7: Local dev loop, client data layer and loading

Stage plan line: no-account dev loop, cosmosClient (retry-safe), CosmosProvider, loading gate + error/Retry, A1 Playwright E2E + CI job (~850 LOC, flagged large).
Plan: docs/plans/server-owned-data-migration-plan.md. No spec file. Plan text pasted verbatim below.

## Plan — Issue Resolutions (context)
## Issue Resolutions

| ID | Title | Detected by | Description | Resolution | Notes |
|----|-------|-------------|-------------|------------|-------|
| I1 | Local development stops working from Phase 7 until Phase 12 | Claude, gpt | Phase 7 makes the app wait for `/api/cosmos` before it draws the map. Locally, nothing answers that request: `npm run dev` starts only Vite (the client dev server), and `client/vite.config.ts` has no `/api` proxy (a rule that forwards API calls to the server). The task "reuse the existing `/api` proxy" points at something that does not exist. Today the AI features run locally only through `vercel dev`, as the README says. So from Phase 7 on, every local run shows the warp for 10 seconds and then the error screen. That blocks the Phase 8 screenshot checks, `npm run record:demo` and the demo-tour timing runs. The proper dev setup only arrives in Phase 12, which also says to "reuse how the server runs today". Today that means `vercel dev`, which needs `vercel link` and a login. That breaks the Phase 12 promise that a fresh fork clone reaches a running map with only `npm run dev`. <br><br> **Before Fix:** Halfway through the migration, opening the app on your own computer shows a loading animation and then an error. You can't check your work or record the demo, and anyone who forks the project needs a Vercel account just to see the map. <br><br> **After Fix:** One command starts the whole app on your computer at every phase, with no account needed, so every check in the plan can actually be run. | Fixed | Dev loop (Node runner on :8787 via `@hono/node-server` + `tsx watch`, Vite `/api` proxy, `concurrently`) moved into Phase 7, first task. Phase 12 keeps only live-data polling and docs. |
| I2 | Retry repeats the failed request instead of trying again | gpt, z.ai | Phase 7 says `startCosmosFetch()` keeps the request it started and returns that same request on every call. If the first attempt fails or hits the 10-second timeout, the stored request is a failure. Retry then calls `startCosmosFetch()` and gets the same failure back at once. Example: the API is down when the page opens, the error screen appears, the API comes back, and the user presses Retry. The error stays, so the Phase 7 acceptance check ("Retry recovers") cannot pass. <br><br> **Before Fix:** Once loading fails, the Retry button does nothing, and the user has to reload the whole page. <br><br> **After Fix:** Pressing Retry really tries again, and the map opens as soon as the server is back. | Fixed | `cosmosClient.ts` clears its cached promise on rejection and aborts via `AbortController` on timeout; test "fails then succeeds after Retry". |
| I3 | The type-generation step will not produce the single file the plan expects | gpt | Phase 5 runs `tsc --declaration --emitDeclarationOnly` on `apiTypes.ts`. That file is allowed to import `types.ts`. The TypeScript compiler writes one declaration file (`.d.ts`, a types-only copy of a code file) for every source file it reads, and it names each output after its source. So the command writes `apiTypes.d.ts` and `types.d.ts`, not one `client/src/api/cosmos-api.d.ts`. The `--outFile` option can't combine them for this project's module setting (NodeNext). The CI check (`git diff --exit-code client/src/api/`) would then guard files the client does not import. <br><br> **Before Fix:** The step that should keep the browser and the server agreeing on the data's shape writes the wrong files. The safety check then watches files nobody uses. <br><br> **After Fix:** The browser gets one exact copy of the server's data description, and CI fails the moment the two stop matching. | Fixed | `apiTypes.ts` is self-contained (no imports); `types.ts` re-exports it; `schema.ts` uses `satisfies z.ZodType<CosmosResponse>`; `types:emit` copies the file with a header, no compiler. |
| I4 | Phase 2 has to change existing values, which the plan forbids | Claude (adversarial) | Phase 2 replaces each service's `color: 'var(--svc-cyan)'` with a `palette: 'cyan'` key. It also replaces topic grouping by name prefix with an explicit `groupServiceId`. Both remove or change values that `baseline-full.json` records. But Phase 2 says "existing values must not change", and the stop list says to stop whenever "a data value must change to make a test pass". If the executing agent follows the plan exactly, it either stops at Phase 2 or keeps `color` forever, and then the coupling to `tokens.css` the phase set out to remove stays. <br><br> **Before Fix:** The plan's own rules contradict each other at Phase 2. The migration either stalls or quietly leaves the old color setup in place. <br><br> **After Fix:** Phase 2 can finish, and tests prove the colors and groupings still look exactly the same. | Fixed | Phase 2 names exactly two allowed fixture changes (`color`→`palette`, prefix rule→`groupServiceId`), each proven by an equivalence test; the stop rule carves out these two. |
| I5 | Pausing Drift Sync by editing the workflow file does not pause it | Claude, z.ai | Phase 1 pauses Drift Sync by disabling the cron in `cosmos-sync.yml`. Scheduled GitHub workflows run only from the copy of that file on the default branch, so editing it on a phase branch changes nothing until that branch merges. The workflow is actually switched on by the repository variable `DRIFT_SYNC_ENABLED`, not by the cron line. Drift Sync PRs that are already open would also still edit `client/src/scenarios/` if they merge mid-migration. Example: a PR opened the night before Phase 1 merges during Phase 5. Now the client copy has a change the server copy lacks, and the parity test blocks every later phase. <br><br> **Before Fix:** The nightly bot can keep editing the old files while you move them, and the two copies of the data quietly stop matching. <br><br> **After Fix:** The bot is really switched off for the whole move, and nothing it opened earlier can land halfway through. | Fixed | Verified: `cosmos-sync.yml:72` gates on `vars.DRIFT_SYNC_ENABLED == 'true'`. Pause via `gh variable set`, drain open Drift Sync PRs, re-enable in Phase 10. |
| I6 | Checking a single preview cannot prove that a deploy publishes new data | grok, preplexity | Phase 4 sets a one-year CDN cache (`s-maxage=31536000`). It relies on "each deployment has its own CDN cache" and verifies that on one preview. One preview only proves that the second request is a cache hit. It can't show that the next production deploy serves new data instead of last year's cached copy. Phase 13 also checks only `x-vercel-cache: HIT` on production, and that check stays green even when the data is stale. <br><br> **Before Fix:** A release could keep showing the old map to visitors, and every check would still pass. <br><br> **After Fix:** Each release proves that the live site shows the data that was just deployed. | Fixed | Build prints the computed `version`; Phase 13 compares production `/api/cosmos` `version` against it; mismatch is a stop condition. |
| I7 | No stated action when the response is over its size target | z.ai | Phase 4 says to record the compressed size of `/api/cosmos` and gives a 100 KB target. It does not say what to do if the response is bigger. Every other target in the plan has a "stop and ask" rule, so the executing agent has to guess here. <br><br> **Before Fix:** If the data comes out too big, whoever is doing the work has to decide alone whether that's acceptable. <br><br> **After Fix:** A response that's too big pauses the work, and the owner decides. | Fixed | Added to the stop list. |


### Ground rules for the executing agent

- Execute phases in order, one phase per branch or commit series; do not start a phase until the previous phase's acceptance passes. The plan targets v1.33.3+; if paths have moved, re-run the Phase 0 inventory and update paths first.
- `CLAUDE.md` wins on process: Conventional Commits, `scripts/version-note.sh write` before every commit, README check on every commit.
- Gates before every commit: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`. Never run `tsc` without `--noEmit`/`-b`.
- Repo invariants hold throughout: unique global `phaseId`; step `from`/`to`/`via`/`through` resolve; world 2400×1400; capsules ≥150px apart; AstroMart stays fictional.
- UI invariants hold throughout: mobile-first, one panel at a time on phones, top-right close control on every floating panel.
- Demo tours keep working after every phase: `?demo=all` ≤120s, `?demo=ai` ≤60s (`client/src/demo/__tests__/scripts.test.ts` or its current location guards them).
- The AstroMart map must look and behave identically after every phase.
- Ambiguity → smaller change, recorded in `docs/plans/server-owned-data-decisions.md`. Stop conditions are listed at the end.

### Phase 7 — Local dev loop, client data layer and loading

**Dev loop first (I1)** — no Vercel account required at any later phase:
- `server/scripts/dev-server.ts` serves the existing Hono `app` with `@hono/node-server` on port 8787. Root script `dev:server`: `tsx watch server/scripts/dev-server.ts` (add `@hono/node-server`, `tsx` if missing, and `concurrently` as root dev dependencies; check each for Node-version compatibility).
- `client/vite.config.ts`: change `server: { port: 5173 }` to `server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } }`.
- Root `npm run dev`: `concurrently -n client,server "npm run dev --workspace client" "npm run dev:server"`. Keep `dev:client` as the client-only escape hatch.
- AI routes keep working under this runner given the same env vars `vercel dev` would supply; document required vars in the README's dev section (the map itself needs none).
- *Verification:* `scripts/__tests__/devLoop.test.mjs` is not worth its flakiness; instead A1's E2E test (below) boots this exact `npm run dev` setup in CI — that is the automated proof. Manual check: fresh shell, `npm run dev`, map loads at `:5173`, `curl -s localhost:5173/api/cosmos | head -c 80` returns JSON.

**Client data layer:**
- `client/src/api/cosmosClient.ts`: `startCosmosFetch()` returns a cached promise. **Retry-safe (I2):** each attempt creates an `AbortController`; a 10s timer calls `controller.abort()`; the promise is stored as `fetchCosmos(controller.signal).then(guard).catch((error) => { cachedPromise = undefined; throw error; })`, so a failed or timed-out attempt is forgotten and the next call starts a fresh request. A successful promise stays cached.
- Call `startCosmosFetch()` at the top of `client/src/main.tsx`, before `createRoot`.
- `client/src/api/CosmosProvider.tsx` with `useCosmos()` returning the loaded response, never `undefined`.
- Loading gate in `App.tsx`, following `shouldShowIntro()`: intro shown → intro as today; on CTA the warp plays until both its normal duration has passed and data is ready. Intro skipped (returning visitor, deep link, `?demo=ai`) → warp as loading screen until ready.
- After 10s timeout or failure: error screen with Retry (calls `startCosmosFetch()` again). Mobile-first; it is a full-screen state, not a floating panel, but includes a clear way out (Retry and a link to the repo README).
- No warp for later requests; the map makes no further data calls.
- Demo tours start only after data is ready.
- *Tests:* `client/src/api/__tests__/cosmosClient.test.ts` with a fake fetch and fake timers: success; slow success under 10s; timeout aborts the signal and rejects; **first attempt fails, Retry's second attempt succeeds** (I2); malformed response rejected by the guard; two concurrent calls share one request. Protects the loading contract and Retry. Unit layer. `client/src/__tests__/loadingGate.test.tsx`: intro-shown vs. intro-skipped paths render warp/intro and then the map; error screen shows Retry. Component layer.

**A1 — End-to-end loading test.** `e2e/cosmos-load.spec.ts` with `@playwright/test` (reuse the browser config conventions from `scripts/record-demo.mjs`), config `e2e/playwright.config.ts` whose `webServer` runs `npm run dev` and waits for `:5173`. Scenarios:
- Load the page with intro skipped (deep link) → map renders, network log shows exactly one `/api/cosmos` request with status 200.
- Open one service passport by clicking a capsule → passport shows the service label from the response.
- Play one scenario via the UI → the step panel advances at least one step.
- Request `/api/cosmos` with the `ETag` from the first response as `If-None-Match` → 304.
Run with `npm run test:e2e`. Add a CI job to `validate-on-pr.yml` that installs Playwright Chromium and runs it. Protects the browser↔server↔map boundary no unit test covers. E2E layer, intentionally one spec. Note: before Phase 8 the map still renders from static imports, so passport/scenario steps pass regardless; they become meaningful as rows migrate — the spec is kept unchanged and re-run after each Phase 8 row.

**Acceptance:** slow-3G throttling shows intro/warp with no blank frame; API down → error screen, Retry recovers once the API is back; no component migrated yet; `npm run test:e2e` green locally and in CI; `npm run parity:screens` green.


### Stop and ask the owner if

- A Phase 0 baseline command fails on `main`.
- A data value must change to make a test pass — **except** the two Phase 2 changes named above (`color`→`palette`, prefix rule→`groupServiceId`), which are proven by equivalence tests instead.
- Vercel's CDN does not serve a new `version` after a deploy, or cold starts stay slow after lazy imports.
- The gzip size of `/api/cosmos` is over 100 KB (I7).
- The production `version` does not match the build's `COSMOS_VERSION` (I6).
- The digest grows more than 50% and trimming would remove information.
- Any change seems to need a database, write endpoint, auth or shared package.
- A phase would change how the map looks or behaves for a visitor.

## A1 addition (accepted)
| A1 | Testing | 🔴 High value | C3 | One automated browser test of the real loading path | preplexity, gpt, z.ai, grok | M | 8% | One Playwright test (an automated browser) starts the app with its server and loads the page through `/api/cosmos`. It waits for the map, opens one service passport and plays one scenario. It would also check the 304 response (the "nothing changed" reply) when the ETag (a fingerprint of the data) still matches. It reuses the browser setup in `scripts/record-demo.mjs` and runs in `validate-on-pr.yml`. <br><br> **Before Add:** Each piece passes its own tests, but nobody checks automatically that the browser, the server and the map work together. A broken connection between them shows up only during the manual checks in Phase 13. <br><br> **After Add:** Every change proves automatically that the real app loads the map from the server and that a visitor can use it. |

## Orchestrator notes
- Extend scripts/cosmos-check.ts with phase 7 checks (pattern established in stages 1–6).
- Record ambiguities in docs/plans/server-owned-data-decisions.md.
- Project CLAUDE.md demo invariants: demo tours must still finish; if loading gate changes when tours start, run npm test (scripts.test.ts guards).
- Mobile-first: error screen verified at ~390px first.
- README: update dev section (npm run dev now runs client+server; dev:client is client-only; dev:server; test:e2e).
- Do not migrate any component to useCosmos() — that is stage 8.
