# Stage 20 report: final acceptance (round 2, after human feedback)

## Files
- vercel.json
- client/src/hooks/useAiConnection.ts
- client/src/hooks/__tests__/useAiConnection.test.ts (new)
- client/src/components/AskAgent.tsx
- client/src/components/__tests__/AskAgent.test.tsx
- client/src/components/__tests__/AskPanel.test.tsx

6 files, at the ceiling of 6. `client/src/App.tsx` needed no change (see Key decisions).

## Summary
Stage 20 has three changes. Together they give a working preview and local `vercel dev`, and a UI that is honest when AI isn't configured:
1. **`includeFiles` fix (round 1, kept).** `vercel.json` now ships `node_modules/openai/lib/**` in the server function. Without it, every `/api` request crashed with `ERR_MODULE_NOT_FOUND` (`openai/lib/responses/ResponseInputItems.js`).
2. **SPA rewrite dropped (human decision).** The `client` service `rewrites` is gone. `vercel dev` now loads the map. On the preview, `/` and `/?…` deep links return 200. An unknown path like `/some/deep/path` now returns 404, which is expected: the app uses only query-string deep links.
3. **New `notConfigured` status.**
   - `useAiConnection` maps `GET /api/ai/status` → `503 { errorCode: 'AI_NOT_CONFIGURED' }` to a new `'notConfigured'` status. Every other failure still maps to `disconnected`.
   - AskAgent shows a red light and the label "No AI agent connected", with no Connect button.
   - The AskPanel "Connect an AI agent for real answers." prompt is hidden, because App already gates it on `status === 'disconnected'`.
   - Joke answers still work.

**Tests.** The new `useAiConnection.test.ts` has 5 tests covering 503 → notConfigured, connected, disconnected, 404 → disconnected, and network error → disconnected. This closes the "useAiConnection has no unit test" carry-over. AskAgent gets a notConfigured test (red dot, no Connect or Disconnect, Search still there). AskPanel gets a status-driven harness: a real hook with a stubbed 503, the joke answer, and no Connect prompt.

**Mutation checks (non-vacuous):**
- Hook maps 503 back to `disconnected`: 2 tests fail (the hook test and the AskPanel test).
- AskAgent shows Connect for `notConfigured`: 1 test fails.
- AskAgent `notConfigured` dot set to `unknown`: 1 test fails.

All were restored and re-run green.

**Gates** (repo root, after all changes):
- `npm run typecheck`: ✅ (exit 0)
- `npm exec -- tsc -p drift-sync --noEmit`: ✅
- `npm run lint`: ✅ (0 errors, 1 old warning at `client/src/map/Map.tsx:814`, exhaustive-deps)
- `npm test`: ✅ (client 7 files / 36 tests, server 13 files / 95 tests)
- `npm run build`: ✅
- `npm run validate`: ✅ (0 errors, snapshot fresh, no drift)

**Preview URL (current, with all three changes):** https://project-cosmos-3zlysj5o5-or-assayags-projects.vercel.app
- Preview only (`target: null`). The build log shows both workspaces installing and building, then "✓ Build complete — Using src/app.ts as the root entrypoint".
- It is behind Deployment Protection. It was reached with `vercel curl`, and for Playwright with a development OIDC token sent as an origin-scoped `x-vercel-trusted-oidc-idp-token` header. The token came from `vercel env run` in a temporary scratch dir holding only a copy of `.vercel/project.json`, which was deleted afterwards. The token was never printed. No settings were changed.

**Acceptance steps:**

| # | Step | 390×844 | 1440×900 | Evidence / reason |
|---|---|---|---|---|
| 1 | Light red, joke answer, **no** connect button or prompt (AI not configured) | PASS | PASS | New preview: `GET /api/ai/status 503`, `lc-status-dot--off`, label "No AI agent connected", 0 "Connect AI Agent" buttons, Search visible, joke answer shown, 0 connect prompts, panel close visible |
| 2 | Bad key → inline error | NOT RUN — human will run it | NOT RUN | With `AI_COOKIE_SECRET` unset, the Connect affordance is now hidden by design, so there is no way to open the modal. Round 1 showed that the inline error UI works (it showed the `AI_NOT_CONFIGURED` text). The `INVALID_KEY` text needs the secret set, so it is in the human checklist. |
| 3–8 | Good key → green, refresh, weather, checkout play, payment-fails glow + usage, disconnect | NOT RUN — human will run them | NOT RUN — human will run them | Per human decision |
| 9 | Old Pages deep link lands on the same view | PASS | PASS | New preview: the real `pages-redirect/index.html`, re-targeted at the preview, is served for `orassayag.github.io/project-cosmos/?…`. Scenario link → `/?scenario=shopping.place-order&step=1` and `?incident=payment-cascade-2026-03-12` → `/?incident=…&step=1`. Each matches the direct load (`sameView: true`). |
| 10a | Fresh clone, no `.env`: `npm run dev:client` loads the map | PASS | — | Map, red light and joke answer, no console errors. With no API behind Vite, `/api/ai/status` gets Vite's `index.html` (200), so the status is `disconnected` and Connect still shows (see Open questions). |
| 10b | Fresh clone: `vercel dev -L` → map works, AI not configured | PASS | PASS | Rewrite dropped. `GET /api/ai/status` → 503 `{"errorCode":"AI_NOT_CONFIGURED"}`, the map renders, red light, joke answer, no Connect button or prompt |

The fresh clone was `git clone --branch feature/add-ai` of the local repo, with this stage's uncommitted `vercel.json` and `client/` diff applied. There was no `.env` and no `.vercel`. All clone servers (Vite and `vercel dev -L --listen 3291`) were killed and the clone was deleted. Two `vite` processes in the project directory (PIDs 23408 and 38781) were already running before this stage and were left alone.

**Screenshots** are in `/private/tmp/claude-501/-Users-orassayag-Repos-project-cosmos/995f7c3b-afc3-457a-b3aa-85102823f5c4/scratchpad/pw/shots/`:
- Step 1: `preview5-{390x844,1440x900}-{load,1a-expanded,1b-joke-answer}.png`
- Step 9: `preview5-9-{scenario,incident}-{via-pages-redirect,direct}-{390x844,1440x900}.png`
- Step 10a: `local5-devclient-390x844-*.png`
- Step 10b: `local5-vercel-dev-{390x844,1440x900}-*.png`

Round-1 shots (`preview-*`, `local-*`) are still there for reference.

## Commit message
fix(deploy): make the Vercel preview and vercel dev work end to end

The final acceptance run found three problems. The server function
crashed on every /api request because the Hono builder's file trace
drops openai/lib/responses/ResponseInputItems.js, so includeFiles now
ships openai/lib. The client service's SPA rewrite also caught Vite's
dev module paths, which left vercel dev blank. It is dropped because
deep links are query-string only. Finally, when the server reports
AI_NOT_CONFIGURED, useAiConnection now returns a distinct notConfigured
status, so the Connect button and prompt are hidden while joke answers
keep working.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

## Key decisions
- **Dropped the `client` service SPA rewrite. This deviates from plan §2, on the human's decision in round 1.**
  - Reason: `vercel dev` applies the rewrite before proxying to Vite. That sends `/@vite/client` and `/src/main.tsx` to `index.html`, so the map is blank and acceptance step 10b fails.
  - The app uses only query-string deep links, and the Pages redirect always lands on `/` + query, so no route needs the fallback.
  - Cost: an unknown path such as `/some/deep/path` now returns 404 instead of the app.
- **The `includeFiles` fix is `services.server.functions["src/app.ts"].includeFiles = "node_modules/openai/lib/**"`.**
  - The path is relative to the repo root, because `@vercel/backends` globs from `repoRootPath`. A `../node_modules` variant failed in round 1.
  - It is a builder-side trace gap: a local `@vercel/nft` run traces the file correctly.
- **Only a 503 carrying `errorCode: 'AI_NOT_CONFIGURED'` maps to `notConfigured`.** A 404 (no API, e.g. old static hosting), other 5xx and network errors stay `disconnected`. That way a transient outage never permanently hides Connect.
  - The status body is now read for non-OK responses too. `connected` still requires `response.ok`.
- **`App.tsx` was not changed.** It already passes `showConnectPrompt={aiConnection.status === 'disconnected'}` and derives `isAiConnected` from `=== 'connected'`, so `notConfigured` hides the prompt and keeps answers as jokes with no edit. A grep of every status consumer confirmed nothing treats the new state wrongly:
  - AskAgent's `DOT_MODIFIER` and `botLabel` handle it explicitly.
  - Its Connect and Disconnect buttons are gated on `=== 'disconnected'` and `=== 'connected'`.
  - App's random-glow choice uses `isAiConnected`.
  - `ConnectAgentModal` uses only `provider`.
- **`connect()` returning `AI_NOT_CONFIGURED` does not switch the status to `notConfigured`.** It is unreachable from the UI now, and it was kept out to keep the change small.
- **The new AskPanel test drives the real hook through a harness that mirrors App's gating expression.** There is still no `App` render harness.

## Open questions
- **Human checklist for steps 2–8** (steps 3–8 are NOT RUN, and the human will run them). Step 2 is included because its Connect button only appears once the secret is set.
  1. Generate a cookie secret:
     ```bash
     openssl rand -base64 32
     ```
  2. In Vercel project settings, add it as `AI_COOKIE_SECRET` for **Preview and Production**.
  3. Set a budget on the AI Gateway key (Vercel dashboard → AI Gateway).
  4. Deploy a new preview from the repo root (env vars apply only to new deployments):
     ```bash
     vercel deploy
     ```
     The current preview, without the secret, is https://project-cosmos-3zlysj5o5-or-assayags-projects.vercel.app.
  5. At **390×844 first**, then desktop, run:
     - Step 2: bad key `sk-ant-invalid` → inline "That key didn't work" error.
     - Step 3: good Claude key → light turns green.
     - Step 4: refresh → still green.
     - Step 5: "what's the weather?" → funny reply, no usage line.
     - Step 6: "play the checkout flow" → scenario plays, no usage line.
     - Step 7: "what happens when a payment fails?" → answer streams, at least two named services glow, usage line appears.
     - Step 8: Disconnect → light turns red.
  6. Report back:
     ```text
     /master feedback
     ```
- **`npm run dev:client` still shows Connect.** Vite answers `/api/ai/status` with `index.html` (200), so the status is `disconnected`, not `notConfigured`, and connecting there fails with a generic error. The plan only asks for `AI_NOT_CONFIGURED` to hide Connect, so this was left. A follow-up could treat a non-JSON status response as `notConfigured`.
- **Extra preview deployments on the project** (all preview, none promoted):
  - `q3wh17zqb`: first broken deploy.
  - `5oyi2c7jz`: failed `includeFiles` path.
  - `f9bbtchq6`: fix proven from the clone.
  - `mk9mt9rfw`: round-1 final.
  - `3zlysj5o5`: current.
- **Ledger carry-overs still open:**
  - Root `"dev": "vercel dev"` and its README line. `vercel dev -L` now works on a fresh clone, so this is unblocked.
  - Whether `.env.local` from `vercel env pull` reaches the server service is still unverified.
  - `AI_PROVIDERS`/`AiProvider` still live in `server/src/logger.ts`.
  - Provider 403/5xx on connect returns 502, not `INVALID_KEY`.
  - The JEV plain-string model id is not verified against the live Gateway (needs a connected ask, steps 6–7).
  - OpenAI/LangChain error shapes are assumed, not observed live.
  - The size of the context digest in tokens has not been measured.
  - Live streaming and abort-on-disconnect against a real provider were not run (steps 7–8).
  - `App.handleAskAction` glow and autoplay are not verified live (steps 6–7).
  - The snapshot is single-line JSON.
  - The `client/vite.config.ts` `BASE_PATH` comment is stale.
  - `steps/core.ts` is an orphan (older than this plan).
  - Deep link `step=N` loads step 1 (older than this plan; the same on direct and redirected loads).
  - 1 exhaustive-deps lint warning at `client/src/map/Map.tsx:814`.
- **Carry-overs closed in this stage:**
  - The `useAiConnection` unit test (added).
  - The server `build` script is harmless on deploy.
  - Workspaces install on Vercel works (build log above).
  - `*Title*` rendering (done in stage 19).
  - The SPA-rewrite and `vercel dev` conflict (rewrite dropped).
