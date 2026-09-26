# Stage 6 report: Hosting — Vercel Services, Pages redirect, env example, README AI block

## Files
vercel.json
.github/workflows/pages.yml
pages-redirect/index.html
server/.env.example
README.md
.gitignore

## Summary
**Edits**
- `vercel.json` now holds the plan §2 Services config: `client` (root `client`, with an SPA rewrite to `/index.html`) and `server` (root `server`). The top-level rewrites send `/api/(.*)` to `server` and everything else to `client`. `git.deploymentEnabled: false` is kept. I checked the schema against the `vercel:vercel-services` skill and it matches the plan exactly.
- `.github/workflows/pages.yml` no longer runs `npm ci` or `npm run build` and no longer uses `setup-node`. It copies `pages-redirect/index.html` to `404.html` and uploads `pages-redirect/` as the Pages artifact.
- `pages-redirect/index.html` (new) is a tiny static page with no external assets:
  - A JS `location.replace` sends the visitor to `https://project-cosmos-six.vercel.app` + (path minus `/project-cosmos`) + `search` + `hash`. It strips a trailing `index.html`/`404.html`.
  - It has a `<meta http-equiv="refresh">` fallback (3s, to the Vercel root), `<link rel="canonical">`, `noindex`, a viewport meta tag, and a visible plain link for no-JS visitors.
- `server/.env.example` (new) lists `AI_GATEWAY_API_KEY` and `AI_COOKIE_SECRET`, each with a one-line comment and no value.
- `README.md` has a new "Run with AI locally" subsection under Quickstart. It lists `vercel link`, `vercel env pull` and `vercel dev`. The alternative is `cp server/.env.example server/.env` then `vercel dev -L`. It also says `npm run dev:client` is the zero-setup path with no AI. The commands are fenced, one per line.
- `.gitignore`: `.env*` and `.vercel` were already there. But the trailing `.env*` line re-ignored `server/.env.example`, because `!.env.example` came earlier in the file. I added `!.env.example` after it, and `server/.env.example` now shows as untracked in `git status`.

**Verification**
| Check | Result |
|---|---|
| `npm run build` | PASS (client + server) |
| `npm run typecheck` | PASS (both workspaces) |
| `npm run lint` | PASS: 0 errors. There are 2 warnings, both pre-existing (exhaustive-deps in `AskPanel.tsx` and `Map.tsx`). |
| `npm run validate` | PASS: 0 errors, and the snapshot is fresh |
| `vercel.json` parses as JSON | PASS |
| `pages.yml` parses as YAML | PASS. The steps are checkout, cp 404, configure-pages, upload-pages-artifact (`pages-redirect`), deploy-pages. There is no build step. |
| Redirect logic (Playwright, scratchpad install, all network intercepted, Vercel requests answered by a stub; 390×844 first, then 1440×900) | 12/12 PASS. `/project-cosmos/?domain=fulfillment&scenario=fulfillment.pack-and-ship&step=3#x` lands on `https://project-cosmos-six.vercel.app/?domain=fulfillment&scenario=fulfillment.pack-and-ship&step=3#x`. A nested path `/project-cosmos/some/nested/path?…` lands on `…vercel.app/some/nested/path?…`. `/project-cosmos/` and `/project-cosmos` land on `…vercel.app/`. `index.html` and `404.html` are stripped. |
| No-JS fallback at 390px | PASS. The link, meta refresh and canonical all point at the Vercel root. `scrollWidth` is 390, so there is no horizontal scroll. The screenshot reads cleanly. |
| `vercel dev -L --listen 3107` | **Partly works.** It detected both services (`client [Vite]`, `server [@vercel/static]`), printed "Available at localhost:3107" and started Vite. But HTTP requests to :3107 hung with no response, for both `/` and `/api/...`, and the Vite child did not stay up. I stopped it. The cause is not diagnosed. The likeliest one is the empty `server` service, which has no entrypoint until stage 11. It could also be a sandbox limit. |

The screenshot (not committed) is at `/private/tmp/claude-501/-Users-orassayag-Repos-project-cosmos/9a7b9873-4093-417a-8691-72bd298fdb46/scratchpad/stage6/redirect-390-nojs.png`. The `vercel dev` process is stopped and no server is left running. I did not deploy anything and did not set any Vercel env vars.

## Commit message
build: host on Vercel Services and turn Pages into a redirect

The AI server needs to share an origin with the client, so vercel.json
now routes /api to a server service and the rest to the client. Pages
stops building the app and forwards old deep links to Vercel instead.

## Key decisions
- **Root `package.json` `dev` left unchanged (still Vite).** `vercel dev` does not serve requests yet while the server service is empty. The brief says to leave `dev` alone in that case. For the same reason, the README uses `vercel dev` directly instead of the plan's `npm run dev`. Once `dev` is switched, the README line should become `npm run dev`.
- **The Pages workflow copies `index.html` to `404.html`.** GitHub Pages only serves `index.html` at the base, and a nested old path would otherwise hit the GitHub 404. Copying in the workflow keeps one source file, so nested deep links redirect too.
- **Meta refresh waits 3 seconds and goes to the Vercel root.** The JS redirect normally fires first and keeps path, query and hash. The fallback cannot compute the path without JS, so it goes to the root.
- **`client/vite.config.ts` `BASE_PATH` left as it is.** Nothing sets it now, so it defaults to `/`, which is harmless. Its comment ("set by the Pages workflow") is now stale. The file was outside this stage's scope, so I did not fix the comment.
- **The README follows the plan's bare `vercel env pull`.** That command writes `.env.local` at the project root by default. Whether Services `vercel dev` passes root `.env.local` to the `server` service is not verified here. See Open questions.
- A `.vercel/` folder (gitignored, with `project.json`) already existed before this stage. I did not touch it.

## Open questions
- When should root `dev` switch to `vercel dev`? This is not a blocker. I suggest switching it in stage 11, once the Hono entrypoint exists, and re-testing `vercel dev -L` then. That also means updating the README line.
- Does `vercel env pull` (root `.env.local`) reach the `server` service under `vercel dev`, or does it need `vercel env pull server/.env`? This is unverified and should be checked with the first real server route.
