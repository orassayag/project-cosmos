# Stage 6 work brief — Hosting: vercel.json Services, Pages redirect page + pages.yml, server/.env.example, README "Run with AI locally"

Stage-plan line: `Stage 6: PLANNED — Hosting: vercel.json Services, Pages redirect page + pages.yml, server/.env.example, README "Run with AI locally"`

## Scope (files this stage owns)
- `vercel.json` — replace with the Services config below.
- `.github/workflows/pages.yml` — stop building the app; publish only the redirect page.
- `pages-redirect/index.html` — new.
- `server/.env.example` — new (both keys, one-line comment each, no values).
- `README.md` — add the "Run with AI locally" block.
- Root `package.json` — `dev` becomes `vercel dev` (plan §1 path-consumer list + §2 "Local development uses `vercel dev`"). `dev:client` stays plain Vite on :5173.
  - CAVEAT: the server has no app entrypoint yet (Hono app lands in stage 11). If `vercel dev` cannot start with the server service empty, do NOT invent a server app here (out of scope). Leave `dev` as-is and raise an Open question. `vercel dev` may also need `vercel link` / login, which is not possible here. Verify what you can (e.g. `vercel dev -L`) and report honestly what was not verified.
- If `.gitignore` lacks `.env` / `server/.env` / `.vercel` entries (so a pulled env file is never committed), add them — check first.

Out of scope: any server code (Hono, routes, config — stages 11+), Vitest (stage 7), deploying anything (never run `vercel deploy`), setting env vars on Vercel.

## Plan §2 — Hosting: Vercel Services + Pages redirect (verbatim)

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

## Related plan excerpts (verbatim)

From §1 path-consumer list:
> Root `package.json`: `dev` runs `vercel dev` (both services). `dev:client` keeps plain Vite on :5173. `build`, `lint`, `typecheck`, and `test` fan out with `--workspaces`. […] **Never use `--if-present` on a gate script.**

From §3 (context only — do not build the server here):
> **Stack:** a Node service in `server/`. Use Hono on Vercel's Node runtime (Node 24 on Vercel, 22 locally per `.nvmrc`).

From Open Questions:
> **npm workspaces on Vercel Services:** ⚠️ not verified here. Confirm on the first preview deploy of Milestone 0 that the `client` and `server` services install correctly from the workspaces root. If not, set each service's `installCommand` explicitly. The snapshot design means neither service imports across folders, so this is only about installing packages.

From Final acceptance (verified in stage 20; this stage enables them):
> 9. Open an old GitHub Pages deep link and land on the same view on Vercel.
> 10. Locally, on a fresh clone with no `.env`: `npm run dev:client` loads the map, and `vercel dev` starts with the map working and AI reported as not configured.

## Current state (orchestrator notes)
- Current `vercel.json` is only `{ "$schema", "git": { "deploymentEnabled": false } }`.
- Current `pages.yml` runs `npm ci` + `npm run build` with `BASE_PATH=/<repo-name>/` and uploads `dist` (already broken after M0 — output is now `client/dist`). Replace with publishing `pages-redirect/` only; no `npm ci`/build.
- GitHub repo name is `project-cosmos` → Pages base `/project-cosmos/`. Vercel target `https://project-cosmos-six.vercel.app` (also root `package.json` `homepage`).
- `client/vite.config.ts:18-19` reads `BASE_PATH` for the Pages build. After this stage nothing sets it; leave it (harmless default `/`) unless removing it is clearly required — record the choice in Key decisions.
- App deep links are query-string based (e.g. `?domain=fulfillment&scenario=fulfillment.pack-and-ship&step=3`), so the redirect must carry `search` + `hash` plus the path minus the `/project-cosmos` base.
- Redirect page: JS redirect (path/search/hash preserved) AND `<meta http-equiv="refresh">` fallback to the Vercel root AND `<link rel="canonical">`. Tiny, no external assets, a visible plain link for no-JS users, a viewport meta tag (mobile-first: must read fine at 390px).
- Use the `vercel:vercel-services` skill (Skill tool) to confirm the `services` / service-targeted `rewrites` schema before finalizing `vercel.json`. If the verified schema differs from the plan's JSON, follow the verified schema and record the difference in Key decisions.
- Bare `npx` / `./node_modules/.bin/*` are permission-denied; use `npm exec -- <bin>`.
- A stale root `vite` may be on :5173; use another port for runtime checks.
- Do NOT write a version note — the orchestrator does that at commit time.

## Verification expected in the report
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run validate` still pass.
- `vercel.json` is valid JSON and matches the verified Services schema.
- `pages.yml` parses as YAML and no longer runs `npm run build`.
- Redirect logic proven locally (Playwright from a scratchpad install, as stage 5 did): load the page as `/project-cosmos/?domain=fulfillment&scenario=fulfillment.pack-and-ship&step=3#x` and show the computed target is `https://project-cosmos-six.vercel.app/?domain=fulfillment&scenario=fulfillment.pack-and-ship&step=3#x` (intercept/abort the real navigation — no network dependency). Also a nested path case and the bare `/project-cosmos/` case. 390px first.
- README "Run with AI locally" commands are fenced, one command per line, and match real scripts.
