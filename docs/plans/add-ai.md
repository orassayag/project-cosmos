# Real AI Agent for "Explore Project Cosmos" — Plan

## Summary

Right now the "Explore Project Cosmos" search box shows canned joke answers. This plan replaces them with a real AI agent. A visitor connects their own Claude or OpenAI API key, and the agent answers questions about the AstroMart map using the map's own services, topics, scenarios, steps, and teams. It can also act on the map: it can light up the services it talks about or play the matching scenario. The answer streams in word by word.

Before any question costs the visitor money, JEV (TypeSafe AI's classification model, reached through Vercel AI Gateway on the site owner's `AI_GATEWAY_API_KEY`) sorts it. JEV decides whether the question is on topic, what the visitor wants, and which scenario they mean. An unrelated question gets a funny reply and never reaches the visitor's paid model.

Supporting this needs a server, so the repo is reorganised into stand-alone `client/` and `server/` folders. Both deploy together as one Vercel project (Vercel Services), so everything is served from one address. The GitHub Pages copy becomes a redirect to Vercel. The visitor's key lives in an encrypted cookie that page scripts can't read, and it survives a refresh.

## Scope

**In scope**
- Repo reorganisation into `client/` + `server/` (npm workspaces), with every path consumer updated (drift-sync, skills, CI, `CLAUDE.md`, `README.md`, scripts) and the full project re-verified afterwards.
- One Vercel project serving both services on one address. GitHub Pages is replaced by a redirect page.
- Search box UI changes: "Go!" renamed to "Search", a bot icon with a red/green status light, and a Connect/Disconnect AI Agent button in the expanded card.
- A connect modal for Claude or OpenAI: the visitor pastes a key, it is checked, and it is stored in an encrypted HttpOnly cookie.
- A server API: `connect`, `disconnect`, `status`, `ask` (streamed).
- The agent: LangChain + LangGraph, with map data as its knowledge and two map-action tools.
- JEV classification: on-topic check, intent, and target scenario. A free keyword fallback runs when JEV is unavailable.
- Clear error messages for out-of-credit, rate-limited, and invalid-key cases.
- Streaming answers, starter question chips, and a per-answer token count (accepted additions A1–A4).
- A Vitest test harness in both workspaces, run in CI.

**Out of scope**
- Visitor accounts or a server-side database. The cookie is the only state.
- Rate limiting and CSRF middleware. Scope Gate rationale: each visitor spends only their own key, and `SameSite=Strict` covers cross-site requests.
- Providers other than Anthropic and OpenAI.
- Chat history and multi-turn conversations. Each question is answered independently.
- Any change to map data content.

### Scope Yardstick

| Dimension | Value | Evidence |
|---|---|---|
| Kind | Demo / portfolio app | `README.md` "Live demo"; `src/components/AskPanel.tsx:12-13` ("portfolio demo with no live model"); `CLAUDE.md` "Demo data is fictional (AstroMart)" |
| Audience & traffic | Public visitors to the live demo, low traffic, each bringing their own AI key | `README.md:4` (public Vercel URL); plan items 5–6 (user pastes own credentials) — traffic `ASSUMED` |
| Surfaces | Today: static site only, no server, no accounts, no persistence. After this plan: a server that receives and stores **other people's API keys** — a real trust boundary | `vercel.json`, `.github/workflows/pages.yml` (static build); plan items 5, 7, 10 |
| Lifetime | Maintained by one person, long-lived portfolio piece | git history, `versions/2026.md` |
| Team | Solo | git log author, `package.json` repository |
| Constraints | Two deploy targets (GitHub Pages + manual Vercel); mobile-first, one-panel-at-a-time and close-button invariants; `npm run build` is the gate; no test runner exists | `CLAUDE.md`, `.github/workflows/pages.yml`, `vercel.json` (`deploymentEnabled: false`), `package.json` scripts |

No original plan supplied — yardstick inferred.

## Issue Resolutions

| ID | Title | Detected by | Resolution | Notes |
|----|-------|------------|------------|-------|
| I1 | "JEV" is not a known tool | Claude | Fixed | JEV is TypeSafe AI's classification model on Vercel AI Gateway (`typesafe-ai/jev`, via AI SDK `experimental_evaluate`), authenticated with the existing `AI_GATEWAY_API_KEY`. See Design §5. |
| I2 | Moving everything into `client/` breaks the rest of the repo | Claude | Fixed | Developer's choice: do the full `client/` + `server/` reorg and fix every consumer. Design §1 lists each one and the re-verification gate. |
| I3 | One of the two live sites cannot run a server | Claude | Fixed | Vercel is the single live site (Services: client + server on one address). The Pages workflow now publishes only a redirect page. Design §2. |
| I4 | Visitors' API keys need a safe storage design | Claude | Fixed | AES-256-GCM encrypted HttpOnly/Secure/SameSite=Strict cookie. Stateless server, no logging of secrets. Design §3. |
| I5 | The agent's actual job is never defined | Claude | Fixed | Agent scope defined: knowledge snapshot, system prompt, map-action tools, graph. Design §6. |
| I6 | "Unrelated questions cost zero tokens" breaks when JEV is not set up | Claude (adversarial) | Fixed | JEV classifies on the site owner's gateway key, so the visitor spends nothing. The fallback is a free keyword check and never the visitor's model. JEV also supplies intent and target scenario. Design §5. |
| I7 | "Authenticate with Claude / OpenAI" is really "paste an API key" | Claude | Fixed | API-key modal, one provider at a time, disconnected behaviour defined. Design §4. |
| I8 | New modal must follow the mobile rules | Claude | Fixed | Mobile-first build, own close button, joins the "One card at a time" policy. Design §4. |
| I9 | The green light can lie | Claude (adversarial) | Fixed | Key checked on connect and on every page load. A 401 disconnects. Design §3. |
| I10 | "No tokens left" is several different errors | Claude | Fixed | Three-way provider error mapping on the server. Design §7. |
| I11 | "Test it" has nowhere to run | Claude | Fixed | Vitest in both workspaces, wired into CI. Tests are named per task below. |
| I12 | Server imports must end in `.js` on Vercel (see L016) | bank | Fixed | `.js` on every relative import under `server/`, enforced by the server's `moduleResolution: NodeNext`. Design §3. |

## Design

Delivery runs in four milestones. Each one ends demonstrable and green on `npm run build`, `npm run lint`, `npm test`, and `npm run validate` before the next starts.

### §1 — Milestone 0: Repo reorganisation (client / server)

**Target layout**

```
project-cosmos/
├── package.json          ← npm workspaces root: ["client", "server"]; orchestration scripts only
├── client/               ← today's Vite app, moved as-is
│   ├── index.html  vite.config.ts  tsconfig.json  package.json
│   ├── public/
│   └── src/              ← scenarios/, incidents/, map/, components/, hooks/, styles/ …
├── server/               ← new Node service (see §3)
│   ├── package.json  tsconfig.json
│   ├── src/
│   │   └── generated/cosmos-map.json   ← committed snapshot of the map data (see below)
│   └── scripts/snapshot-map.ts
├── drift-sync/           ← stays at root, repointed at client/src/scenarios
├── scripts/  versions/  docs/  .claude/  skills/
├── vercel.json           ← Services config (§2)
└── eslint.config.mjs     ← stays at root, covers both workspaces
```

**How the server gets the map data without depending on `client/`.** The map data is the single source of truth, and it stays in `client/src/scenarios/`. drift-sync edits it there, and the skills target it there. `server/scripts/snapshot-map.ts` (run with tsx) imports only the pure data modules (`services`, `topics`, `scenarios`, `steps/*`, `owners`, `incidents/data` — **not** `runner.ts`, which is a React hook) and writes a compact JSON snapshot to `server/src/generated/cosmos-map.json`, which is committed. This keeps `server/` self-contained, so the Vercel server service never reaches outside its root. The snapshot can't silently go stale, for three reasons:
- `npm run validate` regenerates the snapshot in memory and fails when it differs from the committed file, with the message `cosmos-map.json is stale — run npm run snapshot`.
- `drift-sync/scripts/apply-edits.ts` runs `npm run snapshot` after it writes edits, and adds `server/src/generated/cosmos-map.json` to its `WRITABLE_PATHS`.
- `snapshot` is also exposed as a root script.

**Every path consumer to update (the I2 checklist):**
- `drift-sync/scripts/**`: the relative imports `../../src/…` and `../../../src/…` become `../../client/src/…` and `../../../client/src/…`. `WRITABLE_PATHS` and every prompt string in `apply-edits.ts:87-173` that says `src/scenarios/` becomes `client/src/scenarios/`. Also update `drift-sync/README.md` and `drift-sync/tsconfig.json` includes.
- `scripts/fresh-start.mjs`: the `src/scenarios` paths (lines 8, 16, 180).
- `client/vite.config.ts`: `readdirSync('versions')` becomes `'../versions'`.
- `.github/workflows/validate-on-pr.yml`: add the `npm test` step. Commands keep running from root through workspace scripts.
- `.github/workflows/cosmos-sync.yml`: any `src/scenarios` path in its steps.
- `.claude/skills/add-service`, `.claude/skills/add-scenario`, `skills/add-service`, `skills/add-scenario` (56 `src/` references in total).
- `CLAUDE.md` (Layout, Commands, invariants' paths), `README.md`, `CONTRIBUTING.md`.
- Root `package.json`: `dev` runs `vercel dev` (both services). `dev:client` keeps plain Vite on :5173. `build`, `lint`, `typecheck`, `test`, and `validate` fan out with `--workspaces`. Dependencies move into the workspace that uses them. `@anthropic-ai/sdk` stays at root for drift-sync.
- `.gitignore`: `client/dist/`, `server/dist/`, `**/tsconfig.tsbuildinfo`.
- `CLAUDE.md` warning about emitted `.js` shadowing `.tsx` still applies to `client/`, so keep it.

**Use `git mv` for every move** so history follows the files.

**Verification (the "re-test and re-verify" the developer asked for)**
- Gate: `grep -rn "src/scenarios\|src/incidents" --exclude-dir={node_modules,client,dist} .` returns only `client/…`-prefixed hits. This proves no stale path survived.
- `npm run build`, `npm run lint`, `npx tsc -p drift-sync --noEmit`, and `npm run validate` all pass.
- `npm run sync -- --dry-run` against one repo (per `drift-sync/README.md`) completes. This proves drift-sync can still read and resolve the map.
- Runtime: `npm run dev:client`, then drive the map with the `browser-drive` skill: play a scenario, open an incident, open the inspector, use a deep link. Do it at 390px first, then desktop, and compare against screenshots of `main` taken before the move.
- The milestone ships with no behaviour change. The screenshots are the proof.

### §2 — Hosting: Vercel Services + Pages redirect

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
- Environment variables (Vercel project, Production + Preview): `AI_GATEWAY_API_KEY` (already held), and `AI_COOKIE_SECRET` (32 random bytes, base64; generate with `openssl rand -base64 32`). The server fails fast at boot with a named error when either is missing.
- **GitHub Pages redirect:** `pages.yml` stops building the app. It publishes a single `pages-redirect/index.html` that forwards to `https://project-cosmos-six.vercel.app` + `location.pathname` (minus the repo base) + `search` + `hash`, so deep links keep working. It uses a `<meta http-equiv="refresh">` fallback and `<link rel="canonical">`. Verify by opening an old Pages deep link and landing on the same view on Vercel.
- Deploys stay manual (`vercel deploy --prod`), as today.

### §3 — Milestone 2: Server (key handling)

**Stack:** a Node service in `server/`. Use Hono on Vercel's Node runtime (Node 24 on Vercel, 22 locally per `.nvmrc`). Set root `engines.node` to `>=22`, because AI SDK 7 requires Node 22+ and ESM. In `server/tsconfig.json`, set `module`/`moduleResolution: NodeNext`. That makes every extensionless relative import a compile error, so the `.js` rule (L016) is enforced by the type-checker instead of discovered at deploy time.

**Routes**

| Route | Behaviour |
|---|---|
| `POST /api/ai/connect` `{ provider: 'anthropic' \| 'openai', apiKey }` | Validates the body with a Zod `ConnectRequestSchema`. Checks the key with the provider's free `GET /v1/models` (Anthropic `x-api-key` + `anthropic-version`; OpenAI `Authorization: Bearer`). A 401 returns `400 { errorCode: 'INVALID_KEY' }`. On success it sets the cookie, replacing any existing provider, and returns `{ connected: true, provider }`. |
| `POST /api/ai/disconnect` | Clears the cookie (`Max-Age=0`). Returns `{ connected: false }`. |
| `GET /api/ai/status` | No cookie returns `{ connected: false }`. Otherwise it decrypts the cookie and repeats the `/v1/models` check. A 401 clears the cookie and returns `{ connected: false, reason: 'KEY_REVOKED' }`. A network error keeps it connected, since the check is advisory. |
| `POST /api/ai/ask` `{ question }` | Streamed. See §5–§7. |

**Cookie:** `cosmos_ai=<base64url(iv ‖ ciphertext ‖ authTag)>; HttpOnly; Secure; SameSite=Strict; Path=/api/ai; Max-Age=2592000`. The payload is `{ provider, apiKey }` encrypted with AES-256-GCM using `AI_COOKIE_SECRET` through Node's built-in `crypto`. A tampered or undecryptable cookie is treated as "not connected" and cleared. The server stores nothing: it decrypts per request, uses the key, and drops it.

**Logging:** use a structured logger. It never logs request bodies, headers, or the cookie. Error logs carry only `{ errorCode, provider, noPHI: true }`.

**Tests** — `server/src/__tests__/`, Vitest, unit layer:
- `cookieCrypto.test.ts`: encrypt → decrypt round-trip. A flipped byte in the ciphertext or auth tag is rejected. A wrong secret is rejected. *Protects: a forged or tampered cookie can never be read as a valid key.*
- `connectRoute.test.ts`, with the provider `fetch` stubbed: a valid key sets a cookie with all four attributes; a 401 returns `INVALID_KEY` and sets no cookie; a bad body returns a named validation error. *Protects: only working keys get stored, and the cookie is always locked down.*
- `statusRoute.test.ts`: a revoked key (stub returns 401) clears the cookie and reports disconnected. *Protects: the light never stays green on a dead key (I9).*

### §4 — Milestone 1: Client UI (built mobile-first at 390px, then desktop)

**`client/src/components/AskAgent.tsx`**
- Rename the "Go!" button text to **Search** and update its `title` to match.
- Add a **bot icon** on the right side of the input: 🤖 with a status dot. Reuse `.lc-drift-footer-dot` styling, extracted into a shared `.lc-status-dot` class with `--on` (the existing `--svc-green` + pulse) and `--off` (red token from `tokens.css`, no pulse) modifiers. Its tooltip and `aria-label` read "AI agent connected (Claude)" or "No AI agent connected".
- In the expanded footer, next to Search, add **Connect AI Agent** when disconnected and **Disconnect AI Agent** when connected. Use `onMouseDown` + `preventDefault` like the existing button, so the card doesn't collapse first.

**New `client/src/hooks/useAiConnection.ts`**
- Calls `GET /api/ai/status` once on mount and exposes `{ status: 'unknown' | 'connected' | 'disconnected', provider, connect(provider, apiKey), disconnect() }`.
- `unknown` renders the dot grey, so there's no red flash on load for a connected visitor.

**New `client/src/components/ConnectAgentModal.tsx`**
- A provider picker (Claude / OpenAI segmented control) and a key field (`type="password"`, `autoComplete="off"`).
- A "Get a key" link per provider (`https://console.anthropic.com/settings/keys` or `https://platform.openai.com/api-keys`).
- A Connect button with a busy state, and inline errors ("That key didn't work — check it and try again").
- It closes on success. One provider at a time: connecting a second provider replaces the first, and the modal says so.
- **Mobile contract:** it has its own top-right header close button. It joins the "One card at a time" block in `client/src/styles/responsive.css`, so opening it hides the ask/inspector/step panels on phone-class viewports. It is laid out at 390px first and in short landscape (`max-height:480px`).

**Disconnected behaviour:** `AskPanel` keeps `DEMO_ANSWERS`, with one extra line under the joke: "Connect an AI agent for real answers." That line is a button that opens the modal.

**Starter chips (A3):** when the expanded field is empty, show 2–3 clickable example questions ("What happens when a payment fails?", "Which team owns checkout?", "Play the order flow"). Clicking one fills the field and submits.

**Tests**
- Vitest + React Testing Library + jsdom in `client/`, under `client/src/components/__tests__/`:
  - `AskAgent.test.tsx`: shows "Search" (not "Go!"); shows Connect when disconnected and Disconnect when connected; the status dot class follows the connection state. *Protects: the button labels and the light always match reality.*
  - `ConnectAgentModal.test.tsx`: a failed connect shows the inline error and keeps the modal open; success closes it. *Protects: a visitor always knows whether their key was accepted.*
- Visual: drive with `browser-drive` at 390×844 and 844×390, then desktop 1440×900. Screenshot the modal over an open answer panel on a phone to prove no stacking, and confirm the close button is visible.

### §5 — Classification with JEV (the free gate before any paid call)

**Package:** `ai` ≥ 7.0.105 (adds `experimental_evaluate`) in `server/`. Model id `'typesafe-ai/jev'` as a plain string, so AI SDK routes it through AI Gateway using `AI_GATEWAY_API_KEY`. Pass `providerOptions: { gateway: { zeroDataRetention: true } }`, because visitor questions should not be retained. Cost is $0.042 per 1M input tokens, paid by the site owner, with no output charge. The visitor spends nothing on classification.

One `evaluate` call per question. All questions are evaluated in parallel, so this is one round-trip:

```ts
const classification = await evaluate({
  model: 'typesafe-ai/jev',
  state: { question, serviceNames, topicNames, domainNames },
  questions: {
    onTopic: {
      type: 'boolean',
      instructions: 'Is this question about the AstroMart system shown on the map — its services, topics, flows, teams, or incidents?',
      criteria: { true: 'About the map/architecture', false: 'Unrelated (weather, jokes, general trivia, other companies)' },
    },
    intent: {
      type: 'choice',
      instructions: 'What does the visitor want?',
      criteria: {
        explainFlow: 'How something works or what happens when X',
        findService: 'Which service/topic does or owns something',
        playScenario: 'Wants to see a flow play on the map',
        incident: 'About a past production incident',
        ownership: 'Which team owns something',
      },
    },
    targetScenario: {
      type: 'choice',
      instructions: 'Which scenario best matches the question, if any?',
      criteria: { none: 'No specific scenario', ...scenarioCriteriaFromSnapshot },
    },
  },
  providerOptions: { gateway: { zeroDataRetention: true } },
});
```

`state` carries names only, never the full snapshot, which keeps the input small (the "keep state focused" guidance). `targetScenario` options are generated from `cosmos-map.json`, with one entry per scenario (id → title). There are 8 today, well under the 255-option limit.

**Routing decision** (`server/src/agent/route.ts`, a pure function)
- `onTopic.probability < 0.35` → **off-topic**: return a random line from `OFF_TOPIC_ANSWERS`, the same self-aware humour as today's `DEMO_ANSWERS` ("I only know about stars on this map — for the weather, try looking up. ☁️"). The visitor's model is not called.
- `intent = playScenario` **and** `targetScenario ≠ none` with probability ≥ 0.6 → a **direct action**: stream a short templated line ("Playing *Checkout* for you ▶") and a `playScenario` action. The visitor's model is not called.
- Otherwise → **agent** (§6), with `intent` and `targetScenario` passed in as hints.

**Fallback when JEV is unavailable** (gateway error, timeout > 3s, or missing key): run `localRelevance(question, snapshot)`. This is a free check that is on-topic when the question contains any service, topic, domain, team, or scenario name, or an architecture word from a short fixed list. Off-topic → funny reply; on-topic → agent. **The fallback never calls the visitor's model to classify.** That is the I6 guarantee, and a warning log (`JEV_UNAVAILABLE`) makes spikes visible.

**Abuse guard (proportionate):** `/api/ai/ask` returns `401 NOT_CONNECTED` before calling JEV when there is no valid cookie, so the owner's gateway key is only spent for visitors who have already proved they own a working provider key. Set a monthly budget on the AI Gateway key in the Vercel dashboard. That is a one-time manual step, listed in the hand-off.

**Tests** — `server/src/agent/__tests__/`
- `route.test.ts`: a table of classification results mapped to decisions, covering the threshold edges (0.34 / 0.35, 0.59 / 0.6). *Protects: the off-topic and direct-action rules never drift.*
- `classify.test.ts`, with `evaluate` stubbed to throw: the question falls back to `localRelevance`, the visitor-model stub is **never called** for an off-topic question, and a `JEV_UNAVAILABLE` warning is logged. *Protects: the zero-visitor-token promise holds without JEV (I6's adversarial case).*
- `localRelevance.test.ts`: "what's the weather" → off; "what does payments-gateway do" → on.

### §6 — Milestone 3: The agent (LangChain + LangGraph)

**Packages** (in `server/`): `@langchain/langgraph`, `@langchain/core`, `@langchain/anthropic`, `@langchain/openai`. Pin the exact versions resolved at install time. Before writing the graph, read the installed packages' type definitions for the streaming API, and don't rely on recalled signatures.

**Knowledge:** `server/src/agent/context.ts` builds a compact text digest from `cosmos-map.json`, following the pattern of `drift-sync/scripts/lib/cosmos-context.ts`. It covers each service (id, name, domain, owner team, tech, what it talks to), each topic (producers/consumers), each scenario (title plus ordered step summaries), and incidents (title, date, one-line cause). It is built once per cold start and cached in module scope.

**"The skill"** is the system prompt in `server/src/agent/systemPrompt.ts`: *"You are the guide to the AstroMart architecture shown on this map. Answer only from the map data below. When you mention specific services, call `highlight_services`. When the visitor would benefit from seeing a flow, call `play_scenario`. If the data doesn't cover the question, say so plainly. Keep answers under ~150 words."* It is followed by the digest and the JEV hints.

**Model:** a provider factory selects `ChatAnthropic` or `ChatOpenAI` from the cookie's provider, using the visitor's key. The default model ids are constants in `server/src/agent/models.ts`: Claude uses `claude-sonnet-5`, and the OpenAI id is pinned at implementation from OpenAI's current model list.

**Graph** (`server/src/agent/graph.ts`): `START → agent ⇄ tools → END`. `agent` is the chat model bound to two tools, and `tools` runs them. The classification step (§5) runs before the graph is entered, so an off-topic question never instantiates a model.

**Map-action tools (A1):**
- `highlight_services({ serviceIds: string[] })`: validated against snapshot ids with Zod; unknown ids are dropped.
- `play_scenario({ scenarioId: string })`: validated against snapshot scenario ids.

Each tool returns a short confirmation to the model and emits an `action` event onto the response stream.

**Client side of actions:** `App.tsx`'s `handleAsk` currently picks a random `askFocusId` (`App.tsx:376`). Replace that with the ids received from `highlight` actions, and route `playScenario` through the same selection path the deep-link hook uses (`client/src/hooks/useDeepLink.ts`) to start a scenario.

**Tests**
- `graph.test.ts`, with a fake chat model (LangChain's fake tool-calling model from `@langchain/core` testing utilities) that emits a `play_scenario` tool call: the stream contains an `action` event with that scenario id, and an unknown id is dropped. *Protects: the agent can only ever point at things that exist on the map.*
- `context.test.ts`: the digest includes every service id from the snapshot. *Protects: the agent never answers from a partial map.*

### §7 — Streaming protocol, errors, and usage

`POST /api/ai/ask` responds with `Content-Type: application/x-ndjson`, one JSON event per line:

```
{"type":"token","text":"The checkout flow starts at"}
{"type":"action","kind":"highlight","serviceIds":["checkout","payments-gateway"]}
{"type":"action","kind":"playScenario","scenarioId":"checkout"}
{"type":"usage","inputTokens":1180,"outputTokens":142}
{"type":"error","errorCode":"OUT_OF_CREDIT"}
{"type":"done"}
```

**A2 streaming:** `AskPanel` replaces its fake word timer, when connected, with a reader over `response.body`. Tokens append as they arrive, the thinking dots show until the first token, and `onAnswerStart` fires on the first token. When disconnected, the existing fake typing stays.

**A4 usage:** a small muted line under the answer reads "≈ 1,322 tokens". It is built from the `usage` event (input + output, formatted with `Intl.NumberFormat`). Off-topic and direct-action replies show nothing, since they cost the visitor nothing.

**Error mapping** (`server/src/agent/providerErrors.ts`, a pure function from provider error to `errorCode`)

| Provider response | `errorCode` | Message shown in AskPanel |
|---|---|---|
| Anthropic 400 whose message contains "credit balance is too low"; OpenAI 429 with `code: 'insufficient_quota'` | `OUT_OF_CREDIT` | "Your AI account is out of credit — top it up with your provider, then ask again." |
| Any other 429 | `RATE_LIMITED` | "Too many questions at once — try again in a moment." |
| 401 | `INVALID_KEY` | "Your key no longer works." The server clears the cookie in the same response, and the client flips the light red. |
| Anything else | `PROVIDER_ERROR` | "The AI agent hit a problem — please try again." |

Errors thrown inside the server use a typed `ProviderError(message, { errorCode, cause })`.

**Tests** — `providerErrors.test.ts`: one case per table row, including an OpenAI 429 *without* `insufficient_quota` → `RATE_LIMITED`. *Protects: a visitor who is just going too fast is never told they're out of credit (I10).*

### Final acceptance

- `/test` passes: type-check (`tsc -b` in client, `tsc --noEmit` in server and drift-sync), lint, `npm test` in both workspaces, build, and `npm run validate`, which includes the snapshot freshness check.
- End-to-end on a Vercel preview deployment, driven with `browser-drive` at 390px, then desktop:
  1. The light is red and the search box gives a joke answer plus the connect prompt.
  2. Connect with a bad key and see the inline error.
  3. Connect with a good Claude key: the light turns green.
  4. Refresh: the light is still green.
  5. Ask "what's the weather?" and get a funny reply with no usage line.
  6. Ask "play the checkout flow": the scenario plays with no usage line.
  7. Ask "what happens when a payment fails?": the answer streams, services light up, and a usage line appears.
  8. Disconnect: the light turns red.
  9. Open an old GitHub Pages deep link and land on the same view on Vercel.
- Manual, one-time: set `AI_COOKIE_SECRET` on Vercel, and set a budget on the AI Gateway key.

## Open Questions

- **OpenAI default model id:** pinned at implementation from OpenAI's current model list. It is not a blocker.
- **npm workspaces on Vercel Services:** ⚠️ not verified here. Confirm on the first preview deploy of Milestone 0 that the `client` and `server` services install correctly from the workspaces root. If not, set each service's `installCommand` explicitly. The snapshot design means neither service imports across folders, so this is only about installing packages.
- **Scope Challenge (carried from review):** the plan is delivered as the increments above. Milestone 0 (reorg) and Milestone 1 (UI with a stubbed status) are each demonstrable without any AI calls. Milestone 2 makes the light real while answers stay jokes. Milestone 3 brings real answers.
