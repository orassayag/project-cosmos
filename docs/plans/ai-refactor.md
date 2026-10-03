# AI Refactor ("Ask the Agent") — Plan

## Summary
Rework the "Ask the Agent" feature from a visitor-keyed, single-question panel into a keyless,
locally-configured chat. Visitors no longer type API or JEV keys anywhere: the server reads the
model keys from its own `server/.env`, and only when running on the owner's machine. The
top-of-page ask inputs disappear; a chatbot-style bot button sits bottom-right and keeps today's
red (not connected) / green (connected) states. Red opens a modal explaining how to connect the
agent and JEV locally. Green opens a right-side, multi-turn chat whose agent can only look and
show — it drives the same read-only map actions a visitor can, and never changes saved state.
Both scripted demos are updated to show a connected agent holding a short conversation.

## Scope
**In scope**
- Remove the top ask input/textarea on desktop and mobile (original item 1).
- Bottom-right chatbot button with red/green states, designed phone-first (items 2, I7).
- Red → instructions modal for local agent + JEV setup; no key fields (item 3).
- Server reads `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` from env, locally
  only; the live (Vercel) deployment always reports not-configured (items 5, I1).
- Removal of key cookie, `/ai/connect`, `/ai/disconnect`, `AI_COOKIE_SECRET`, visitor JEV key,
  joke answers and the random-star fallback (I8).
- Right-side multi-turn chat with bounded, validated history (items 6a/6b, I4).
- Follow-up-aware routing — no off-topic reply once a conversation has started (I2).
- Explicit allow-list of agent actions; no writes of any kind (item 6c, I5).
- Panel layout rules so the chat and right-side panels never cover each other (I3).
- Both demos (`?demo=ai`, `?demo=all`) show a connected multi-turn chat within 60s / 120s (item 4, I6).
- A1 Stop and New-chat buttons · A2 Chat survives closing the panel · A3 Suggested follow-up chips.

**Out of scope**
- Real AI answers on the live site (deliberately disabled — see I1).
- Persisting chat across page reloads (A2 is in-memory only).
- New write-capable tools, layout editing, or any database mutation by the agent.
- Changing the agent's model ids, the JEV classifier model, or the map data.

## Issue Resolutions
| ID | Title | Detected by | Description | Resolution | Notes |
|----|-------|-------------|-------------|------------|-------|
| I1 | Where the AI keys come from, and what the live site does, is never decided | Claude | Item 5 removes key input, so keys must come from the server's settings file. If the owner ever sets them on the live site, every visitor spends the owner's money with no limit. <br><br> **Before the Fix:** One key added on the live site lets any stranger run up the owner's AI bill. <br><br> **After the Fix:** Real answers only work on the owner's own machine; the live site shows the setup instructions. | Fixed | Keys are read only on a local run; the live site always shows red, and Claude wins when both keys are set. |
| I2 | Follow-up chat questions get the "off-topic" joke reply | Claude (adversarial) | The question sorter (`server/src/agent/classify.ts`, plus its keyword fallback) sees only the latest message. A follow-up like "and who owns it?" names nothing on the map. <br><br> **Before the Fix:** You ask about checkout, then "why does it fail?", and get a joke about being off-topic. <br><br> **After the Fix:** Follow-up questions are answered in the context of the conversation. | Fixed | Only the first message is sorted; every later message goes straight to the agent with the conversation attached. |
| I3 | The chat moves right, onto the panels the agent itself opens | Claude (adversarial) | On desktop the step panel, health card, changelog and side-by-side details card all sit on the right. The agent's own "play scenario" and "show health" actions open them under the right-side chat. <br><br> **Before the Fix:** You ask "show me the order flow", the flow plays, and its step list is hidden behind the chat. <br><br> **After the Fix:** The flow's steps and the chat are both readable, or the chat steps aside until you return. | Fixed | The chat collapses to a slim tab while a right-side panel is open, and the details card moves left. |
| I4 | "No injections" is asked for but the chat history has no rules | Claude | A chat sends earlier messages back to the server each turn. Nothing says what the server accepts, so a request could slip in fake "assistant" or "tool" messages, or grow without limit. <br><br> **Before the Fix:** A crafted request can pose as the agent and make the chat ever more expensive. <br><br> **After the Fix:** The server only trusts the visitor's own words, and each turn has a clear cost limit. | Fixed | The server accepts only plain user/assistant text, keeps the last 10 turns, and caps total length. |
| I5 | "Anything we can do manually" is not a list | Claude | Some manual actions change saved state: layout edit and "reset layout" write to the browser's storage. Item 6c forbids changes, but the plan never names which actions are allowed. <br><br> **Before the Fix:** A new "do what I can do" tool could drag stars around and save that for good. <br><br> **After the Fix:** The agent can only look and show; nothing it does is saved. | Fixed | The allowed actions are the seven existing map tools plus six read tools, pinned by a test. |
| I6 | The demos script only one question and answer, but the chat needs a conversation | Claude | The demo's answer data (`server/src/cosmos/data/demo.ts`, `aiTour`) holds one question and answer. The demo also opens Connect and pastes keys, which no longer exist. <br><br> **Before the Fix:** Both demos break: they click a key field that is gone and show a single answer. <br><br> **After the Fix:** Both demos show a connected agent chatting back and forth, inside their time limits. | Fixed | The tour data becomes a short scripted chat, and the demos start already connected. |
| I7 | The bottom-right bot and right-side chat have no phone design | Claude | Mobile-first is a project rule, but the plan only describes desktop. On phones the bottom corner holds the playback bar and zoom buttons, and the chat needs a close button. <br><br> **Before the Fix:** On a phone the bot covers the play controls, and the chat overlaps other cards. <br><br> **After the Fix:** The bot and chat fit on a phone, with one card showing at a time and an easy way to close it. | Fixed | Phone layout is designed first: the bot sits above the playback bar and the chat is a full-width sheet. |
| I8 | Old key and joke code is left behind | Claude | Going keyless makes these unused: the key cookie and `AI_COOKIE_SECRET`, `/ai/connect`, the visitor's own JEV key, the joke answers in `AskPanel.tsx`, and the random-star search. There is also unused chat styling (`.lc-chat-*` in `app.css`). <br><br> **Before the Fix:** Dead routes and settings stay around and confuse whoever sets the project up. <br><br> **After the Fix:** Setup needs only the keys the instructions name, and there's nothing left over. | Fixed | All listed leftovers are removed, the old chat styles are reused, and the setup docs are updated. |

## Design

Delivered in two increments (from the draft's Scope Challenge), each shippable and demonstrable
on its own. Increment 2 never touches key handling.

### Increment 1 — Keyless server + red/green entry point

#### 1.1 Server: env-only keys, local only (I1, item 5)
- New `server/src/agentConfig.ts` (replaces the cookie half of `config.ts`):
  `getAgentConfig(): { provider: 'anthropic' | 'openai'; apiKey: string; gatewayApiKey: string | null } | null`.
  - Returns `null` whenever `process.env.VERCEL` is set — the live deployment never answers with
    the owner's keys, even if they are configured there. Logged once at INFO with
    `errorCode: 'AI_DISABLED_ON_DEPLOYMENT'`.
  - Provider precedence: `ANTHROPIC_API_KEY` wins over `OPENAI_API_KEY` when both are set
    (logged once at INFO, `errorCode: 'AI_PROVIDER_BOTH_SET'`). Neither set → `null`.
  - `AI_GATEWAY_API_KEY` stays optional; without it classification uses the local keyword fallback.
  - Read per call, never at import — the map still boots without any AI env.
- `server/src/app.ts`:
  - `GET /ai/status` → `{ connected: true, provider }` or `503 { errorCode: AI_NOT_CONFIGURED }`.
    It no longer pings the provider per call (no visitor key to revoke).
  - `POST /ai/ask` resolves `getAgentConfig()` instead of the cookie; `null` → 503.
  - Delete `/ai/connect`, `/ai/disconnect`, `readAiCookie`, `clearAiCookie`, `cookieCrypto.ts`,
    `ConnectRequestSchema`, `getCookieSecret`.
  - `answerQuestion` / `createChatModel` take the `AgentConfig` in place of `AiCookiePayload`
    (same `provider`/`apiKey`/`gatewayApiKey` fields, so the factory body barely changes).
- Verify:
  - `server/src/__tests__/agentConfig.test.ts` (new, unit) — protects: `VERCEL` set ⇒ null even
    with keys; precedence; missing keys ⇒ null; whitespace-only keys treated as missing.
  - `server/src/__tests__/statusRoute.test.ts`, `askRoute.test.ts` (rewrite, route-level) —
    protects: 503 when not configured; ask streams with env keys; no cookie is read or set.
  - Delete `connectRoute.test.ts`; trim `config.test.ts` to what remains.

#### 1.2 Client: remove inputs, bottom-right bot (items 1, 2, I7)
- Remove the `AskAgent` input/textarea from the top bar and the mobile drawer (`App.tsx:719`,
  `secondaryActions`). `AskAgent.tsx` becomes `AgentButton.tsx`: a round bot button with a
  chat-bubble affordance (speech-tail badge, `aria-label="Open the agent chat"`), keeping today's
  red / light-green status colours.
- **Phone first:** the button sits bottom-right *above* the playback bar and clear of the zoom
  buttons (`bottom: calc(var(--playback-h) + 12px)`), 48px tap target. Desktop: same corner,
  same offset rule. Position rules live in `client/src/styles/responsive.css`.
- `useAiConnection` drops `connect`/`disconnect`; status is `unknown | connected | notConfigured`.
- Verify:
  - `client/src/components/__tests__/AgentButton.test.tsx` (rename of `AskAgent.test.tsx`, unit) —
    protects: red vs green class from status, click opens the right surface per status.
  - `client/src/hooks/__tests__/useAiConnection.test.ts` (trim, unit) — protects: 503 ⇒
    `notConfigured`, 200 ⇒ `connected`.
  - Manual: phone viewport 390×844 and 844×390 — button does not cover play/zoom controls.

#### 1.3 Red → instructions modal (item 3)
- `ConnectAgentModal.tsx` loses every input. It shows: a short line on why it's red, then a
  numbered setup in fenced blocks — copy `server/.env.example` to `server/.env`, set
  `ANTHROPIC_API_KEY` *or* `OPENAI_API_KEY`, optionally `AI_GATEWAY_API_KEY` for JEV, run
  `pnpm dev`. On the live site it adds one line: "Live answers are only available when running
  the project locally." Has its own top-right close button (mobile close-button contract).
- Verify: `client/src/components/__tests__/ConnectAgentModal.test.tsx` (rewrite, unit) —
  protects: no input elements rendered; env var names present; close works.

#### 1.4 Removal of leftovers (I8)
- Delete: `cookieCrypto.ts`, `connectRequestSchema.ts`, `AI_COOKIE_SECRET` everywhere
  (`.env.example`, `scripts/fresh-start.mjs`, README), the visitor JEV key field, joke answers
  in `AskPanel.tsx` and `server/src/agent/offTopicAnswers.ts` (see 2.2 for the replacement
  first-message reply), the random-star fallback in `App.tsx:384`.
- `server/.env.example` documents exactly `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `AI_GATEWAY_API_KEY`, with the "local only" note. `README.md` setup section updated.
- Verify: `pnpm typecheck` + `pnpm lint` (unused-import/route sweep); `grep -r AI_COOKIE_SECRET`
  returns nothing outside `versions/`.

Increment 1 is demonstrable: live site red with instructions; local `.env` turns it green with
the existing single-answer panel.

### Increment 2 — Right-side chat

#### 2.1 Chat request contract (I4)
- `server/src/schemas/askRequestSchema.ts` becomes:
  ```ts
  ChatMessageSchema = z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) })
  AskRequestSchema  = z.strictObject({ messages: z.array(ChatMessageSchema).min(1).max(20) })
  ```
  plus refinements: last message is `user`; roles alternate; the server keeps only the last
  `CHAT_HISTORY_TURNS = 10` turns; total characters ≤ `CHAT_TOTAL_MAX_CHARS = 8000`; the newest
  user message keeps the existing 500-char limit. No `system`, `tool`, or tool-call fields are
  accepted (strict object rejects them with a field-named error).
- Assistant turns from the client are passed to the model as plain `AIMessage` text — never as
  tool calls — so a crafted history cannot fake tool output.
- Verify: `server/src/schemas/__tests__/askRequestSchema.test.ts` (new, unit) — protects:
  rejects `system`/`tool` roles, extra fields, non-alternating roles, over-length totals;
  trims to 10 turns. Route-level: `askRoute.test.ts` 400 cases with the field named in the error.

#### 2.2 Follow-up-aware routing (I2)
- `answerQuestion` receives `messages`. If `messages.length === 1`, classify the first message
  as today (`classifyQuestion` → `decideRoute`). If it is a follow-up, skip classification and go
  straight to the agent with the whole history (`graph.ts` seeds `state.messages` with the
  mapped history instead of a single `HumanMessage`).
- First-message off-topic reply becomes one fixed polite redirect (no random jokes):
  "I can only help with the AstroMart map — try asking about a service, a flow, or a team."
- Verify: `server/src/agent/__tests__/route.test.ts` + `classify.test.ts` (extend, unit) —
  protects: follow-ups never classified, never get the off-topic reply;
  `graph.test.ts` (extend) — history reaches the model in order.

#### 2.3 Allowed agent actions (item 6c, I5)
- The agent's tool set is exactly, and only:
  - Map actions (`mapActionTools.ts`): `highlight_services`, `play_scenario`,
    `show_blast_radius`, `open_passport`, `show_health`, `show_ownership`, `open_changelog_entry`.
  - Read tools (`readTools.ts`): `get_service`, `get_steps`, `blast_radius`, `who_owns`,
    `on_call`, `drift`.
- Explicitly excluded: layout edit mode, layout reset, connect/disconnect, starting a demo, and
  anything writing `localStorage`, cookies, or server data. No new tools are added in this plan.
- Export `AGENT_TOOL_NAMES` from `graph.ts`. Client `onAskAction` handles only the seven map
  action types; unknown types are ignored and logged at WARN.
- Verify: `server/src/agent/__tests__/graph.test.ts` (extend, unit) — protects: the bound tool
  names equal the 13-name allow-list exactly (adding a tool fails the test until the list is
  reviewed). `client/src/__tests__/askMapActions.test.tsx` (extend) — protects: no action
  touches layout storage.

#### 2.4 Chat panel (items 6a/6b, I3, I7)
- `AskPanel.tsx` becomes `AgentChat.tsx`: message list + composer, reusing the dormant
  `.lc-chat-*` styles in `client/src/styles/app.css`. Streams via `askStream.ts`, which now posts
  `{ messages }`. Map actions emitted mid-stream still run through `onAskAction`.
- **Phone first:** full-width bottom sheet (max 75vh), own top-right close button, joins the
  "One card at a time" block in `responsive.css` at the same priority as today's ask card.
- **Desktop:** docked right, 360px wide, below the top bar.
- **Layout rules (I3):** when a right-side panel opens (step panel, health card, changelog) the
  chat collapses to a slim right-edge tab showing the latest line and an unread dot; clicking
  the tab restores it and the panel yields. The side-by-side details card moves to the *left*
  while the chat is open (`Map.tsx:495` — `fitTo` padding swaps to `left: 380, right: 380`).
- Verify:
  - `client/src/components/__tests__/AgentChat.test.tsx` (rename/rewrite of `AskPanel.test.tsx`,
    unit) — protects: sends full history, appends streamed reply, close button present.
  - `client/src/__tests__/chatLayout.test.tsx` (new, component) — protects: opening the step
    panel collapses the chat; closing it restores; details card side flips.
  - Manual on 390px and desktop: play a scenario via chat; steps and chat both readable.

#### 2.5 A1 — Stop and New-chat buttons
- Composer shows **Stop** while streaming: aborts the `fetch` (`AbortController`); the server
  already propagates the abort signal. The partial reply stays, marked "stopped".
- Header **New chat** clears the in-memory conversation (2.6) and returns to starter chips.
- Verify: `AgentChat.test.tsx` — protects: Stop aborts the request and re-enables the composer;
  New chat empties history so the next request has one message (and is classified again).

#### 2.6 A2 — Chat survives closing the panel
- Lift the conversation state into a `useAgentChat()` hook owned by `App.tsx`, so unmounting
  `AgentChat` keeps it. Memory only — a reload clears it (out of scope to persist).
- Verify: `client/src/hooks/__tests__/useAgentChat.test.ts` (new, unit) — protects: close →
  reopen keeps messages; New chat clears.

#### 2.7 A3 — Suggested follow-up chips
- After each finished reply, show 2–3 follow-up chips using the existing starter-chip style.
  Generated without extra model calls: derived from the last answer's map actions and mentioned
  ids (e.g. "Who owns {service}?", "What breaks if {service} fails?", "Play {scenario}"), via a
  pure `suggestFollowUps(lastAnswer, snapshot)` in `client/src/components/followUps.ts`.
  Tapping a chip sends it as the next user message.
- Verify: `client/src/components/__tests__/followUps.test.ts` (new, unit) — protects: ≤3 chips,
  only ids that exist in the snapshot, none when nothing was mentioned.

#### 2.8 Demos (item 4, I6)
- `aiTour` in `server/src/cosmos/data/demo.ts` becomes `aiTour.turns: [{ question, scriptedAnswer }]`
  with 2–3 turns (Fulfillment changes → "Who owns shipping?" → follow-up chip tap). Update the
  `aiTour` schema in `server/src/cosmos/schema.ts` and `validate.ts`, run `pnpm types:emit`,
  `pnpm fixture:cosmos`, and update `fixtures/baseline-full.json`.
- `useDemoAiConnection` starts already `connected`; Connect / paste-key steps are removed.
  `buildAiDemoScript()` and the AI segment of `buildAllDemoScript()` click the bot, type, ask,
  then tap a follow-up chip — all as real UI gestures on new `data-demo-target`s
  (`agent-button`, `agent-composer`, `agent-send`, `agent-followup-0`). Phone variant per
  `buildDemoScript(mode, { isPhone })`.
- Verify: `client/src/demo/__tests__/scripts.test.ts` — protects: ai ≤60s, all ≤120s;
  `demoTargets.test.tsx` — every target exists; `scriptedAnswer.test.ts` and
  `server/src/__tests__/demoData.test.ts` — turns shape. Re-record both modes with
  `pnpm record:demo ai|all`.

### Known accepted gaps
- No issue was ignored. The one deliberate limitation: the live site never answers with real AI
  (I1) — visitors there see the instructions modal and the scripted demos only.

### Final acceptance
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm validate`, `pnpm test:e2e`
  all green (`/test`). `pnpm types:emit` leaves no diff.
- End to end, locally: empty `.env` → red bot → modal; add `ANTHROPIC_API_KEY` → green → ask,
  follow up, play a scenario from chat, Stop, New chat, close/reopen keeps history — on a
  390px viewport first, then desktop.
- With `VERCEL=1 pnpm dev:server` and keys set, `/api/ai/status` returns 503.
- `README.md` updated (removed inputs, keyless setup, env vars); version note written.

## ➕ Additions to the Project (3): 0 🟣 | 0 🔴 | 2 🟡 | 1 🔵 | 0 🟠

> All additions below were **accepted into this plan** (`--additions`) and are designed in
> `## Design` — `/spec`, `/master` and `/orca` build them as part of it.
>
> **Session %** is the share of one 5-hour session's 15,000,000-token allowance an AI agent
> would burn implementing that addition end to end (see `~/.claude/skills/_lib/session-cost-model.md`).

| # | Category | Value | Conf | Title | Detected by | Size | Session % | Description |
|---|----------|-------|------|-------|-------------|------|-----------|-------------|
| A1 | UX | 🟡 Medium value | C3 | Stop and New-chat buttons | Claude | S | 3% | A "Stop" button cancels an answer mid-stream, and "New chat" clears the conversation. The server already supports cancelling. <br><br> **Before Add:** A long or wrong answer can't be stopped, and starting over means reloading. <br><br> **After Add:** You can cut an answer short and start a fresh topic with one click. |
| A2 | UX | 🟡 Medium value | C2 | Chat survives closing the panel | Claude | S | 3% | Keep the conversation in memory while the page is open, so closing and reopening the chat brings it back. <br><br> **Before Add:** Close the chat to look at the map and the whole conversation is gone. <br><br> **After Add:** Reopen the chat and pick up where you left off. |
| A3 | UX | 🔵 Low value | C2 | Suggested follow-up chips | Claude | S | 3% | After each answer, show 2–3 tap-to-ask follow-ups, using the existing starter-chip style. <br><br> **Before Add:** After an answer you have to think up and type the next question. <br><br> **After Add:** One tap keeps the exploration going, which is especially handy on a phone. |

**Added to this plan: ~9% of a 5h session.**
