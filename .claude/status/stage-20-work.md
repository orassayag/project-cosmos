# Stage 20 work brief — Final acceptance: /test + preview-deploy end-to-end at 390px then desktop

## Stage scope
Verification stage. Produce evidence, not features. Code changes only if a check genuinely fails and the fix is small and in-scope (a bug the acceptance run exposes); anything larger → `## Open questions`, not a fix.

1. **Repo gates** (run from the repo root, the same set `/test` runs): `npm run typecheck`, `npm run lint`, `npm test` (client + server), `npm run build`, `npm run validate` (incl. snapshot freshness). Record each result.
2. **Local fresh-clone check (acceptance step 10):** clone the repo (`git clone` of the local repo at branch `feature/add-ai`) into the session scratchpad — never inside the project tree — with no `.env`; `npm install`; `npm run dev:client` loads the map (drive it with Playwright/browser-drive at 390px, screenshot); then `vercel dev` (or `vercel dev -L` if linking the clone is not possible) starts with the map working and `GET /api/ai/status` / the UI reporting AI as **not configured**. Kill every server you start. Delete the scratch clone afterwards.
3. **Vercel preview deployment (acceptance steps 1–9):** the project is already linked (`.vercel/project.json`; `vercel whoami` = the project owner). Deploy a **preview** (never `--prod`) with the Vercel CLI from the repo root. Do not change project settings, env vars, domains, or production aliases. If the preview is behind Deployment Protection, use `vercel curl` / the documented bypass approach, not a settings change. Then drive the preview with Playwright (browser-drive playbook, stable accessibility selectors) at **390×844 first**, then **1440×900**, capturing a screenshot per step into the scratchpad:
   1. light red; search gives a joke answer + connect prompt.
   2. connect with a bad key (e.g. `sk-ant-invalid`) → inline error.
   3–8. **need a real, working Claude API key, which only the human can supply.** Do NOT look for keys in env files, shell history, keychains, or anywhere else, and never invent one. Write `.claude/status/stage-20-blocker.md` asking the human to either provide a key for steps 3–8 (or run them themselves), and report steps 3–8 as NOT RUN.
   9. an old GitHub Pages deep link (see `docs/` / the Pages redirect page from stage 6 for its URL shape, e.g. `?domain=…&scenario=…&step=…` and `?incident=…`) lands on the same view on the preview.
   Also check server env on the preview: if `AI_COOKIE_SECRET` is not set there, the AI routes answer `AI_NOT_CONFIGURED` — report that as a manual step for the human (plan: "Manual, one-time: set `AI_COOKIE_SECRET` on Vercel, and set a budget on the AI Gateway key"); do not set it yourself.
   Also resolve the plan's open question: do the `client` and `server` services install correctly from the npm workspaces root on Vercel? Report ✅/❌ with the build-log evidence.
4. **Ledger carry-overs:** don't fix them; list which carry-overs from the ledger's "Still open" lines remain open after this stage, so the final approve has one list.

Report: the preview URL, a table of every acceptance step with PASS / FAIL / NOT RUN (+ reason) per viewport, screenshot paths, and gate results. `## Files` lists only project files you changed (likely none; scratch artifacts don't belong there). Carry uncertainty honestly — anything not actually observed is "not verified".

## Plan text (pasted verbatim from docs/plans/add-ai.md)

### Final acceptance

- `/test` passes: type-check (`tsc -b` in client, `tsc --noEmit` in server and drift-sync), lint, `npm test` in both workspaces, build, and `npm run validate`, which includes the snapshot freshness check.
- End-to-end on a Vercel preview deployment, driven with `browser-drive` at 390px, then desktop:
  1. The light is red and the search box gives a joke answer plus the connect prompt.
  2. Connect with a bad key and see the inline error.
  3. Connect with a good Claude key: the light turns green.
  4. Refresh: the light is still green.
  5. Ask "what's the weather?" and get a funny reply with no usage line.
  6. Ask "play the checkout flow": the scenario plays with no usage line.
  7. Ask "what happens when a payment fails?": the answer streams, **at least two named services glow**, and a usage line appears.
  8. Disconnect: the light turns red.
  9. Open an old GitHub Pages deep link and land on the same view on Vercel.
  10. Locally, on a fresh clone with no `.env`: `npm run dev:client` loads the map, and `vercel dev` starts with the map working and AI reported as not configured.
- Manual, one-time: set `AI_COOKIE_SECRET` on Vercel, and set a budget on the AI Gateway key.

## Open Questions

- **OpenAI default model id:** pinned at implementation from OpenAI's current model list. It is not a blocker.
- **npm workspaces on Vercel Services:** ⚠️ not verified here. Confirm on the first preview deploy of Milestone 0 that the `client` and `server` services install correctly from the workspaces root. If not, set each service's `installCommand` explicitly. The snapshot design means neither service imports across folders, so this is only about installing packages.
- **Scope Challenge (carried from review):** the plan is delivered as the increments above. Milestone 0 (reorg) and Milestone 1 (UI with a stubbed status) are each demonstrable without any AI calls. Milestone 2 makes the light real while answers stay jokes. Milestone 3 brings real answers.

### §2 — Hosting: Vercel Services + Pages redirect (for context on steps 9–10)


`vercel.json` becomes:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": { "deploymentEnabled": false },
  "services": {
    "client": {
      "root": "client",
      "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
    },
    "server": { "root": "server" }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "server" } },
    { "source": "/(.*)", "destination": { "service": "client" } }
  ]
}
```

- The server receives the full path (`/api/ai/…`), so its routes are declared with the `/api` prefix.
- The client and the API share one origin, so the key cookie is first-party and survives refresh. The client calls relative `/api/ai/*` URLs, which also makes preview deployments self-consistent.
- Local development uses `vercel dev`, which runs both services and serves `/api` on the same origin.
- Environment variables (Vercel project, Production + Preview): `AI_GATEWAY_API_KEY` (already held), and `AI_COOKIE_SECRET` (32 random bytes, base64; generate with `openssl rand -base64 32`). Neither variable stops the server from starting — the map needs no AI:
  - `AI_COOKIE_SECRET` is required only by the routes that read or write the cookie (`connect`, `status`, `ask`). When it is missing they return `503 { errorCode: 'AI_NOT_CONFIGURED' }` and log one error; `disconnect` still clears the cookie. The client treats `AI_NOT_CONFIGURED` from `status` as disconnected and hides the Connect button.
  - `AI_GATEWAY_API_KEY` missing → classification uses the free `localRelevance` fallback (§5) with a single `JEV_UNAVAILABLE` warning at first use, not per request.
- **Local setup:** `server/.env.example` lists both keys with a one-line comment each (no values). README gets a "Run with AI locally" block: `vercel link` → `vercel env pull` → `npm run dev` (or `vercel dev -L` to run without logging in to Vercel, using a hand-filled `server/.env`). `npm run dev:client` stays the zero-setup, no-AI path.
- **GitHub Pages redirect:** `pages.yml` stops building the app. It publishes a single `pages-redirect/index.html` that forwards to `https://project-cosmos-six.vercel.app` + `location.pathname` (minus the repo base) + `search` + `hash`, so deep links keep working. It uses a `<meta http-equiv="refresh">` fallback and `<link rel="canonical">`. Verify by opening an old Pages deep link and landing on the same view on Vercel.
- Deploys stay manual (`vercel deploy --prod`), as today.

