# Project Cosmos

[![Validate](https://github.com/orassayag/project-cosmos/actions/workflows/validate-on-pr.yml/badge.svg)](https://github.com/orassayag/project-cosmos/actions/workflows/validate-on-pr.yml)
[![Live demo](https://img.shields.io/badge/demo-live-6f42c1)](https://project-cosmos-six.vercel.app/)
[![Release](https://img.shields.io/github/v/release/orassayag/project-cosmos)](https://github.com/orassayag/project-cosmos/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Originally based on [Cosmos OS](https://github.com/ludeo-labs/cosmos-os) — see [Origin & credits](#origin--credits).

**A living map of your architecture.** Every service is a star. Kafka topics orbit between them. Real flows play as comets you can watch, pause, and inspect — payloads included. Ask the map a question in plain English and an AI agent answers from the map itself. And a nightly AI agent keeps the whole map honest against your actual code.

<p align="center">
  <a href="https://project-cosmos-six.vercel.app/"><b>▶ Live demo</b></a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#ask-the-agent-ai">AI agent</a> ·
  <a href="#make-it-your-cosmos">Make it yours</a> ·
  <a href="#drift-sync">Drift Sync</a>
</p>

<p align="center">
  <img src="images/demo.png" alt="The Project Cosmos map playing the Place an order scenario — services as stars, Kafka topics as orbitals, the step panel showing the real request payload, and the Incidents, Changelog, Ownership, Blast radius and Health controls" width="100%">
</p>

## Why

Every architecture diagram starts dying the moment it's born. The wiki page is from two reorgs ago, the Lucidchart link is stale, and the only reliable documentation is a senior engineer with a whiteboard. Project Cosmos takes a different bet:

1. **The map is the source, not a mirror.** Everything you see — services, topics, flows — is one set of plain TypeScript files. No database, no sync job to a diagramming SaaS. The map works with no server at all; the server only exists to power the optional AI agent.
2. **Flows are playable, not drawn.** A scenario is a real request traced hop-by-hop: URL, headers, payload, what got produced to which topic, what got written to which database. Press play and watch it fly.
3. **Honesty is automated.** A nightly agent diffs your repos against the map and opens one PR per team when reality moved. Forgetting to update the docs stops being an option.
4. **Questions get answered from the map, not from guesses.** The AI agent only knows what the map knows, and can only point at services and scenarios that really exist on it.

## What's in the box

### The map

- 🗺️ **The map** — an animated SVG cosmos of your services (planets), Kafka topics (orbitals), and protocol-colored connections (HTTP amber, WebSocket cyan, Kafka orange). Every service is a distinct world — terran, cratered, banded, icy, volcanic or ringed — derived deterministically from its id, over nebula fields with parallax panning.
- 🎬 **Scenario player** — named end-to-end flows play as comets along real curved paths, with a step panel showing the actual request/response payloads at every hop, and an on-map stepper to walk through them. Deep-linkable (`?domain=…&scenario=…&step=…`).
- 🚨 **Incident replay** — pick a past production incident from the **Incidents** list and press play. The map replays the exact path the failing request (or cascade) took, with the real (redacted) payloads captured at the time, a red comet, a banner so it never reads as live traffic, and a star explosion when the meteor hits the failing service. Deep-linkable (`?incident=…&step=…`).
- 🔎 **Quick search** — press `/` anywhere and start typing: services, topics and scenarios rank together in one palette, and picking a result warps the map straight to it.
- 📜 **Live activity log** — a running `LIVE · ACTIVITY` feed of every step as it fires during playback, so you can read the whole path at once instead of one step at a time.
- 🔍 **Service passports** — click any star: owner team, repo link, stack, databases, and why it exists.
- 🪐 **Service ecosystems** — umbrella services expand into a mini solar system of sub-services; packets re-route through the internals during playback.
- ✏️ **Layout edit mode** — hit `Edit layout` (or press `L`), drag stars and topics where you want them, then `Copy coords` and paste the values into the data files. Try it in the [live demo](https://project-cosmos-six.vercel.app/) — your rearrangement stays in your browser only.

### Insight views

- 🔦 **Blast radius** — click a service or topic and the map ranks everything that would break if you changed it, HIGH → MED → LOW. It walks the real dependency graph, which reverses direction for synchronous calls versus Kafka hand-offs, so the answer is genuine impact, not just "what's connected."
- 🌡️ **Service health heat map** — stars tint by commit age and open-PR backlog (fresh → warm → hot); click one for its on-call card: who's holding the pager, until when, and which Slack channel to escalate in.
- 👥 **Ownership view** — an ownership legend that isolates everything a team owns with one click, so a crowded galaxy collapses to just one team's surface.
- ✨ **What changed last night** — after a nightly run, the affected services and topics glow on the map in their change color; the overlay lists each finding with a link to the draft PR the pipeline raised. A footer status pill links straight to the latest run on GitHub Actions.
- 🗞️ **Architecture changelog** — the drift history as a browsable "added / changed / risk / removed" list; click an item to warp the map into that commit's context and jump to its PR or the affected node.

### AI

- 💬 **Ask the agent** — a natural-language question box over the whole architecture, backed by a real LangChain + LangGraph agent. Connect your own Claude or OpenAI key and the answer streams in word by word, with a token count; the agent can light up every service it mentions and start playing the matching scenario. Without a key you get playful demo answers and a one-tap link to connect. See [Ask the agent (AI)](#ask-the-agent-ai).
- 🌙 **Drift Sync** — the nightly honesty robot. Diffs every tracked repo against a baseline SHA, filters noise with cheap regexes, asks an AI agent "does the map still tell the truth?", and opens one tidy PR per team with file:line evidence.
- 🤖 **Two Claude skills** — `/add-service` and `/add-scenario` teach [Claude Code](https://claude.com/claude-code) to interrogate your repos and grow the map for you: who do you call, what do you produce, to which topic, what database are you hiding.

### Presenting and sharing

- 📽️ **Presentation mode** — `P` strips the UI back to the bare map and fattens the comets so a scenario reads from the back of the room; the arrow keys and space still drive playback with the controls hidden.
- 🎥 **Self-playing demo tours** — open the site with `?demo=ai` or `?demo=all` and it tours itself. See [Demo tours](#demo-tours).
- 📱 **Mobile-first** — the whole app works on a phone. See [Mobile](#mobile).
- 🏷️ **Version badge** — the top bar shows the current version from the [version ledger](#versioning).

## Quickstart

Requires Node ≥ 22.

```bash
git clone https://github.com/orassayag/project-cosmos.git
cd project-cosmos
npm install
npm run dev
```

Open http://localhost:5173 — you're looking at **AstroMart**, a fictional space-gear e-commerce platform that ships with the repo as demo data. Pick a domain, choose a scenario (start with *Place an order*), press play.

`npm run dev` starts only the client (Vite): the whole map works, and the Ask box gives demo answers. To run the AI agent too, see [Run with AI locally](#run-with-ai-locally).

### Useful commands

Run from the repo root — it is an npm workspaces root (`client/`, `server/`).

| Command | What it does |
|---|---|
| `npm run dev` | Client dev server on `:5173` (no AI) |
| `npm run build` | Builds every workspace (client: `tsc -b && vite build`) — the gate for every change |
| `npm run typecheck` | Type-checks every workspace, no emit |
| `npm run lint` | ESLint over `client/`, `server/`, `drift-sync/`, `scripts/` |
| `npm test` | Vitest in the client and server workspaces |
| `npm run snapshot` | Regenerates `server/src/generated/cosmos-map.json` from the map data |
| `npm run validate` | Data sanity: ids resolve, `phaseId`s unique, spacing ok, snapshot fresh |
| `npm run fresh` | Replaces AstroMart with a minimal 2-star starter cosmos |
| `npm run record:demo -- ai\|all` | Records a demo tour to `recordings/demo-<mode>.webm` |
| `npm run sync`, `sync:*` | Drift Sync entry points — see [`drift-sync/README.md`](drift-sync/README.md) |

### Run with AI locally

The client and the AI server run together on one origin through the [Vercel CLI](https://vercel.com/docs/cli). Link the project and pull its environment variables:

```bash
vercel link
vercel env pull
vercel dev
```

To run without logging in to Vercel, copy the example env file, fill in the keys by hand, and start local-only mode:

```bash
cp server/.env.example server/.env
vercel dev -L
```

| Variable | Required | What it does |
|---|---|---|
| `AI_COOKIE_SECRET` | For AI | 32 random bytes, base64 (`openssl rand -base64 32`). Seals the visitor's key cookie. Without it the AI routes answer `503 AI_NOT_CONFIGURED` and the Ask box shows "No AI agent connected". |
| `AI_GATEWAY_API_KEY` | No | Vercel AI Gateway key used by JEV to triage questions. Without it, triage falls back to a free local keyword check. |

A visitor can also paste their own Vercel AI Gateway key in the Connect window (the optional JEV field); it is sealed in the same encrypted cookie and used for question triage instead of the site's key.

### Driving it from the keyboard

Everything the map does is reachable without the mouse:

| Key | What it does |
|---|---|
| `/` | Quick search — jump to any service, topic or scenario |
| `Space` | Play / pause the current scenario |
| `←` `→` | Previous / next step |
| `P` | Presentation mode — hide the chrome for a talk |
| `B` | Blast radius |
| `H` | Service health heat map |
| `O` | Ownership view |
| `C` | What changed last night (only once a drift run has landed) |
| `L` | Layout edit mode |
| `+` `−` | Zoom in / out |
| `0` | Reset the zoom |
| `Esc` | Reset the galaxy — clears the scenario, filters, selection and URL |

Mouse equivalents: drag the background to pan, scroll to zoom around the cursor, click any star or topic to open its panel. On touch screens: drag to pan, pinch to zoom, tap to open.

## Ask the agent (AI)

The **Ask** box (the "Explore Project Cosmos" search) answers questions about the architecture — *"What happens when a payment fails?"*, *"Which team owns checkout?"*, *"Play the order flow"*. Empty, it offers those three as one-tap starter chips.

### Connecting

A small robot icon with a red/green light shows whether an agent is connected. **Connect AI agent** opens a window where the visitor picks **Claude** or **OpenAI** and pastes their own API key; the server checks it with the provider on the spot and reports the result. An optional second field takes a Vercel AI Gateway key for JEV triage. **Disconnect** clears it at any time.

The key never touches page scripts or storage: it is sealed with AES-256-GCM into an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/api/ai`, and the server is stateless — no accounts, no database. The key is re-checked on every page load, so the green light turns red if it stops working, and a key revoked mid-answer disconnects automatically.

### How a question is answered

```
question → JEV triage (site's or visitor's AI Gateway key; free keyword fallback)
   ├─ off-topic                        → a canned playful reply, 0 tokens on the visitor's key
   ├─ "play X" with a confident target → plays the scenario directly, 0 tokens
   └─ everything else                  → LangGraph agent on the visitor's Claude / OpenAI key
                                           ├─ streams the answer (NDJSON)
                                           ├─ highlight_services → lights up every service it names
                                           └─ play_scenario      → starts the matching flow
```

- **JEV** (`typesafe-ai/jev` on Vercel AI Gateway, zero data retention) decides whether the question is about the map, what the visitor wants, and which scenario they mean — with a 3-second budget. If it is slow, unconfigured or unavailable, a free local keyword check decides on-topic vs. off-topic instead. Triage never calls the visitor's model.
- **The agent** is a LangGraph `StateGraph` (agent ⇄ tools) over LangChain chat models — `claude-sonnet-5` or `gpt-6-sol` — with a compact digest of the map snapshot (services, topics, scenarios, steps, teams) as its only knowledge. Its two tools accept only ids that exist in the snapshot, so it can never point at an invented service. Answers are capped at ~150 words.
- **Errors are explained, not dumped**: out of credit, rate-limited, invalid key, or a general provider problem — never echoing any part of the key.

### Server API

The server (`server/`) is a [Hono](https://hono.dev) app served under `/api`:

| Route | What it does |
|---|---|
| `POST /api/ai/connect` | Validates `{ provider, apiKey, gatewayApiKey? }`, checks the key with the provider, sets the encrypted cookie |
| `POST /api/ai/disconnect` | Clears the cookie (works even when AI is not configured) |
| `GET /api/ai/status` | `{ connected, provider }`; clears a revoked key |
| `POST /api/ai/ask` | Streams `token` / `action` / `usage` / `error` / `done` events as NDJSON |

The agent reads the map from `server/src/generated/cosmos-map.json`, a committed snapshot of the client's map data — run `npm run snapshot` after any data edit; `npm run validate` fails if it is stale.

## Demo tours

Open the site with `?demo=ai` (≤60 s) or `?demo=all` (≤120 s) and it plays a scripted tour of itself; add `&speed=2` (up to 8) to fast-forward. Any click or key press stops it.

- **`demo=ai`** opens the Fulfillment domain, connects an AI agent, types a question and shows the answer lighting up the map.
- **`demo=all`** tours the whole app: the intro, domains, playing and stepping a scenario, replaying an incident, the ownership view, and the AI agent.

The tours drive the **real UI**: a human-like pointer glides along curved paths, overshoots and settles, and types with natural rhythm, dispatching the same pointer, mouse and keyboard events a person would. Only the AI connection and the answer are faked, so a tour never contacts a real AI service. On phones the pointer is hidden and the tours open the menu drawer when they need it.

Record a tour to video (with the dev server running):

```bash
npm run record:demo -- ai
npm run record:demo -- all
```

The recorder uses Playwright and fails if the tour aborts or runs over its time limit. It targets `http://localhost:5173` unless `BASE_URL` is set.

## Mobile

The app is built mobile-first and verified on a ~390px-wide phone first, then on desktop.

- **Phone-class** means `max-width: 768px` **or** `max-height: 480px` (landscape phones); the `useViewport` hook mirrors this onto `<html data-viewport data-touch>` so CSS and JS agree.
- On phones the topbar collapses into a slide-over **drawer** (domain and incident pickers, Ask, changelog, presentation, help), and every floating panel docks as a **bottom sheet** clear of notches and home indicators.
- **One panel at a time** — panels never stack: a detail card (inspector, ask, health card) hides the context panels behind it.
- **Every panel has a close button** in its top-right corner on phones.
- Touch gestures: drag to pan, two-finger pinch to zoom.

## Make it your cosmos

The entire universe lives in `client/src/scenarios/` — plain, typed TypeScript:

| Concept | What it is | Where |
|---|---|---|
| **Service** | A deployed process → a planet on the map | `services.ts` |
| **Topic** | A Kafka topic used as an edge → an orbital node | `topics.ts` |
| **Domain** | A group of related scenarios | `scenarios.ts` |
| **Scenario** | A named, playable end-to-end flow | `scenarios.ts` |
| **Step** | One hop: from → to, protocol, payload | `steps/*.ts` |
| **Team** | An owner, for the ownership view and passports | `owners.ts` |
| **Incident** | A past production incident, frozen in time and replayable | `client/src/incidents/*.ts` |

**Start from the template:** click **Use this template** on GitHub (or clone), then:

```bash
npm install
npm run fresh   # replaces AstroMart with a minimal 2-star starter cosmos
npm run dev     # your galaxy, ready to grow
```

Two ways to populate it:

**With Claude Code (recommended)** — the repo ships with two skills. Open the repo (plus your service repos) in a Claude Code workspace and say:

```
/add-service payments
/add-scenario show me what happens when a customer checks out
```

You can also install the skills into any environment as a plugin, no clone needed:

```
/plugin marketplace add orassayag/project-cosmos
/plugin install cosmos@project-cosmos
```

…then use `/cosmos:add-service` and `/cosmos:add-scenario` anywhere.

The skills make Claude read your actual source — call sites, producers, consumers, schemas — and write verified entries. No guessing allowed; the skill files are the guardrails.

**By hand** — copy any AstroMart entry, follow the shapes in `types.ts`, and keep three invariants: unique ids, `hex` matches the color token, and `phaseId`s are global and never reused. `npm run build` type-checks everything, and `npm run validate` is the data sanity gate — it checks that every `from`/`to`/`via`/`through` resolves to a real service or topic, that `phaseId`s are unique, that capsules keep their minimum spacing, and that the committed map snapshot (`server/src/generated/cosmos-map.json`) is fresh — run `npm run snapshot` after any data edit and commit the snapshot with it. All of these run in CI on every PR (the **Validate** badge above), alongside `npm run lint` and `npm test`.

Placing nodes is easiest visually: enter **Edit layout** mode, drag things into place, `Copy coords`, and paste the numbers back into `services.ts` / `topics.ts`. Topics normally auto-arrange in a ring around their owning service — if a ring slot collides with a neighbor, set `pinned: true` on the topic and it fans out to your hand-placed coordinates instead.

To start clean, empty the arrays in `services.ts`, `topics.ts`, `scenarios.ts`, and `steps/`, then grow your own sky.

## Record a production incident

An incident is just a scenario frozen in time. Recordings live in `client/src/incidents/` (one file per incident); the app discovers, lists, and plays them automatically — no AI, no backend, no database. Recording one takes 10–30 minutes for someone who already has the logs:

1. **Open the closest scenario** in `client/src/scenarios/steps/` (or start blank) and note the hops the failing request actually took.
2. **Copy the relevant steps** and replace the example payloads with the real ones from the logs — redact card/customer/token fields (`"[redacted]"`).
3. **Add the title, date, and a one- or two-sentence note** describing what went wrong.
4. **Give it a globally-unique `phaseId`** (incidents use `101+` so they never collide with scenarios) and set every step's `phase` to that same id.
5. **Save the file** under `client/src/incidents/`, import it in `client/src/incidents/data.ts`, and drop it into the `INCIDENTS` array. `npm run build` type-checks it; `npm run snapshot` makes it known to the AI agent.

Every step's `from` / `to` / `via` / `through` must match an existing `SERVICES[].id` or `TOPICS[].id` — incidents reuse the same map you already drew.

A complete, copyable example (trimmed):

```ts
// client/src/incidents/checkout-timeout-2026-08-01.ts
import type { Incident } from './types';

export const CHECKOUT_TIMEOUT_2026_08_01: Incident = {
  incident: true,
  id: 'checkout-timeout-2026-08-01',
  domain: 'incidents',
  phaseId: 104,                       // globally unique, never reused
  status: 'ready',
  label: 'Checkout timeout',
  color: 'var(--svc-red)',
  date: '2026-08-01',
  time: '11:20 UTC',
  note: 'Orders backed up when payments stopped responding — captures queued and checkout requests timed out.',
  short: 'Payments stalls; checkout requests time out.',
  refs: [{ label: 'Post-mortem ticket', url: 'https://tickets.example.dev/INC-2400' }],
  steps: [
    { phase: 104, from: 'orders', to: 'payments', type: 'http',
      label: 'POST /v1/payments/capture', title: 'orders → payments: capture hangs',
      plain: 'orders called payments synchronously; payments never answered.',
      payload: `POST /v1/payments/capture

{ "orderId": "ord_A1B2...", "paymentMethodToken": "[redacted]" }

// no response for 30s — upstream timeout` },
    // …more hops…
  ],
};
```

Then register it:

```ts
// client/src/incidents/data.ts
import { CHECKOUT_TIMEOUT_2026_08_01 } from './checkout-timeout-2026-08-01';
export const INCIDENTS: Incident[] = [
  CHECKOUT_TIMEOUT_2026_08_01,
  // …existing incidents…
].sort((a, b) => b.date.localeCompare(a.date));
```

The three incidents that ship with AstroMart (`client/src/incidents/*.ts`) are working references — copy whichever is closest to your first real recording.

## Drift Sync

The map you can't trust is worthless — so Project Cosmos ships with its own lie detector. Every night:

```
clone tracked repos → diff vs baseline SHA → regex prefilter (~95% exit free)
   → AI agent reads the survivors → drift verdict with file:line evidence
   → applier edits the map, validates in-loop → one draft PR per team → Slack ping
```

Merging the PR bumps the baseline inside the same PR — merge means caught-up, no state cron needed. The pipeline also refreshes the AI agent's map snapshot. Full setup (GitHub PAT, Anthropic API key, optional Slack) in [`drift-sync/README.md`](drift-sync/README.md). It's off by default; enable it when you're ready.

## Project layout

```
client/                 Vite + React app (the map)
  src/scenarios/        the universe as typed data — most changes belong here
  src/incidents/        recorded production incidents
  src/map/              SVG map rendering, edges, planets, insight views
  src/components/       UI shell: intro, playback, step panel, Ask box, Connect window
  src/demo/             self-playing demo tours
  src/hooks/            viewport, deep links, map view, AI connection
  src/overlays/         overlay manager (one panel at a time)
  src/styles/           tokens, app, components, responsive.css (loaded last)
server/                 Hono API for the AI agent (Vercel Function)
  src/agent/            JEV triage, routing, LangGraph agent, map-action tools
  src/generated/        cosmos-map.json — committed snapshot of the map data
drift-sync/             the nightly honesty pipeline (its own README)
scripts/                fresh-start, demo recorder, version + README-reminder hooks
versions/               the version ledger, one file per year
pages-redirect/         the GitHub Pages redirect page to the Vercel app
skills/                 add-service, add-scenario as a plugin (.claude-plugin/)
.claude/skills/         add-service, add-scenario, update
docs/                   plans and working status
```

## Deployment

The app is one [Vercel](https://vercel.com) project using **Vercel Services** (`vercel.json`): `client/` serves the static app and `server/` serves `/api/*` as a function, both on one origin. Git auto-deploys are off — deploy deliberately with `vercel deploy`. Set `AI_COOKIE_SECRET` (and optionally `AI_GATEWAY_API_KEY`) in the project's environment variables; without them the map still deploys and works, with AI switched off.

The old GitHub Pages address now serves only a redirect page (`pages-redirect/`) that forwards visitors and their deep links to Vercel.

## Testing and CI

- **Vitest** in both workspaces (`npm test`): the client suite covers the Ask box, the Connect window, the answer stream, the demo runner, human-like motion, and that every element a demo tour clicks really exists; the server suite covers the routes, cookie crypto, config, JEV triage, the local fallback, routing, the agent graph, and provider-error mapping.
- **CI** (`.github/workflows/validate-on-pr.yml`) runs lint, build, the drift-sync type-check, `npm test`, and `npm run validate` on every PR and push to `main`.

## Versioning

Every commit is auto-versioned by a local post-commit hook (`scripts/version-bump.sh`): the Conventional Commits type decides the bump (`feat` → minor, `!` / `BREAKING CHANGE` → major, anything else → patch), a plain-English row is added to `versions/<year>.md`, and the commit is tagged `vX.Y.Z`. The top bar shows the current version. A companion `commit-msg` hook (`scripts/readme-reminder.sh`) prints a non-blocking reminder to refresh `README.md` and the GitHub description when a `feat` or breaking commit does not stage the README. Install both hooks once per clone:

```bash
bash scripts/install-hooks.sh
```

With Claude Code, `/update` writes the version note, commits, and pushes in one step, and `/revert <x.y.z>` restores any recorded version. The ledger is generated — never edit `versions/*.md` by hand.

## Tech notes

- **Client**: Vite 8 + React 19 + TypeScript (strict), Framer Motion for panels. The map needs no server and no database — the whole universe is typed data bundled into the build.
- Comets glide on the **real rendered SVG paths** (GSAP MotionPath + `getPointAtLength()`), not approximations.
- The hyperspace intro is a plain `<canvas>` and one perspective formula — no 3D library.
- OKLCH color tokens, themeable (`cosmos`, `light`, `minimal`, `dark`).
- **Server**: Hono on Vercel Functions (Node), Zod-validated requests, structured logging that never records keys, AES-256-GCM cookie sealing.
- **AI**: LangChain (`@langchain/anthropic`, `@langchain/openai`) + LangGraph for the agent; the AI SDK's evaluation API on Vercel AI Gateway for JEV triage; the Anthropic SDK for Drift Sync.

## Origin & credits

Project Cosmos is originally based on [Cosmos OS](https://github.com/ludeo-labs/cosmos-os), created by [Omer Sher](https://github.com/ludeo-labs) at [Ludeo](https://ludeo.com) and released under the MIT License. The original copyright notice is preserved in [`LICENSE`](LICENSE).

Cosmos OS began as an internal tool at Ludeo, built to answer "wait, what happens after the client sends this?" without archaeology. The full story: [Your architecture diagram is already wrong — so I built a galaxy instead](https://medium.com/@omersher_79552/your-architecture-diagram-is-already-wrong-so-i-built-a-galaxy-instead-d4cf6c62ade9).

On top of the original map, this project adds:

- **A real AI agent** — a Hono server on Vercel running a LangChain + LangGraph agent that
  answers questions about the architecture with the visitor's own Claude or OpenAI key, streams
  the answer, and lights up services or plays scenarios on the map. Questions are triaged first
  by **JEV** (a classification model on Vercel AI Gateway) so off-topic questions never cost the
  visitor a token.
- **Architecture insight views** — incident replay, blast-radius analysis, a service health
  heat map with on-call cards, an ownership view, a "what changed last night" drift overlay, and
  a browsable architecture changelog.
- **A mobile-first, responsive UI** — a phone drawer, bottom-sheet panels, pinch-zoom, and a
  strict one-panel-at-a-time policy.
- **Self-playing demo tours** (`?demo=ai`, `?demo=all`) that drive the real UI with a human-like
  pointer, plus a Playwright recorder.
- **Presentation mode, an on-map step stepper, quick search, a live activity log**, and a richer
  visual layer (planet morphology, nebula fields, parallax panning, star explosions).
- **A client/server npm-workspaces layout, Vitest suites in both workspaces, and a local
  version ledger** with a version badge in the top bar.

## Contributing

PRs welcome — [CONTRIBUTING.md](CONTRIBUTING.md) has the dev setup and the three invariants that bite. Security reports: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Ludeo, © Or Assayag
