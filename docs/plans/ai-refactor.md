# AI Refactor ("Ask the Agent") — Plan

Project repo: https://github.com/orassayag/project-cosmos
Project production: https://project-cosmos-six.vercel.app

## Summary
Turn "Ask the Agent" from a single-question panel that asks visitors for API keys into a
multi-turn chat that needs no keys. The server reads the model keys from its own `server/.env`,
and only when the owner runs it on their own machine: the dev server listens on loopback only,
and the agent is switched on only by the local dev script. The ask inputs at the top of the
page go away. A bot button sits bottom-right and stays red (not connected) or green (connected).
Red opens a window that explains how to set up the agent and JEV locally, with wording based on
why it is red. Green opens a right-side chat. The agent can only look at the map and show things
on it, never change saved state, and its errors and token use appear right in the chat.

Both scripted demos show a connected agent holding a short conversation. They answer from
scripted turns on the client, so the live site needs no AI key. This plan is a second review
round. The decisions from the first round are built into `## Design`, and the issue IDs below
are from this round.

## Scope
**In scope**
- Remove the ask input at the top of the page on desktop and in the mobile drawer.
- Bottom-right bot button, red/green, designed for phones first.
- Red → setup window with no key fields. Its wording depends on the status reason
  (`AI_NOT_LOCAL` vs `AI_NOT_CONFIGURED`) (I8).
- Server reads `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` from env, and
  only when the local dev entry point turns the agent on. The dev server listens on
  `127.0.0.1` (I1).
- Remove the key cookie, `/ai/connect`, `/ai/disconnect`, `AI_COOKIE_SECRET`, the visitor JEV
  key, the joke answers, the random-star fallback, and the "key rejected → disconnect" path (I7).
- Right-side multi-turn chat. History is limited by message count and validated (I4).
- Follow-ups go straight to the agent. Only the first message is checked for off-topic.
- Explicit allow-list of agent actions; no writes of any kind.
- Layout rules so the chat and right-side panels never cover each other. The chat collapses
  only after an answer finishes (I5).
- Stop and New-chat buttons. A stopped reply gets a marker so the history stays valid (I3).
  New chat cancels any answer still running (I6).
- The chat survives closing the window, including an answer still streaming (I6).
- Suggested follow-up chips.
- Provider errors shown as chat messages; token count under each reply (I7).
- Both demos (`?demo=ai`, `?demo=all`) answer from client-side scripted turns that carry their
  own map actions, within 60s / 120s (I2).
- Accepted additions: **A1** Playwright test for the chat and the demo chat · **A2** "billed to
  your own key" note · **A3** "Thinking…" dots · **A4** character counter · **A5** `A` key toggles
  the chat.

**Out of scope**
- Real AI answers on the live site (turned off on purpose).
- Keeping the chat after a page reload (memory only).
- New tools that write, layout editing, or any database change made by the agent.
- Changing the agent's model ids, the JEV classifier model, or the map data (other than the
  `aiTour` demo data).

## Issue Resolutions
| ID | Title | Detected by | Description | Resolution | Notes |
|----|-------|-------------|-------------|------------|-------|
| I1 | "Local only" isn't actually enforced | preplexity, grok | The local server listens on the whole network, not just this computer. The only off switch is a Vercel setting, so any other copy with keys answers anyone. <br><br> **Before the Fix:** Someone on the same café Wi-Fi, or any other host running the project, can run up the owner's AI bill. <br><br> **After the Fix:** Real answers only ever come from the owner's own machine, for the owner. | Fixed | The dev server listens only on this computer, and only the local dev script can switch the agent on. The Vercel check stays as a backup. |
| I2 | The demos have scripted answers but no way to show them in the new chat | gpt, Claude | Today the demo swaps in a scripted answer, but the new chat asks the server, which is off on the live site. The plan also dropped the map effects that go with each answer. <br><br> **Before the Fix:** The demo types a question on the live site and gets an error, or a reply with nothing lighting up on the map. <br><br> **After the Fix:** The demo shows a full back-and-forth chat with the map reacting, with no AI key anywhere. | Fixed | During a demo, each answer comes from the scripted turns, with that turn's map effects. A follow-up chip always matches the next scripted question. |
| I3 | After pressing Stop, the next question is rejected | preplexity, Claude (adversarial) | A stopped reply is sent back as if it were finished. If it is empty, the server rejects every later question. <br><br> **Before the Fix:** You press Stop, ask again, and the chat errors until you start a new chat. <br><br> **After the Fix:** You can stop and ask again freely, and the agent knows its last answer was cut short. | Fixed | A stopped reply is sent with a short "stopped" note, so it is never empty and turns still alternate. |
| I4 | "Last 10 turns" and "up to 20 messages" don't say the same thing | preplexity | The plan gave two different limits and never said whether long chats are refused or shortened. Shortening could also leave the conversation in a broken order. <br><br> **Before the Fix:** A long chat suddenly fails, or the agent forgets different things depending on who built it. <br><br> **After the Fix:** Long chats keep working, and everyone knows exactly what the agent remembers. | Fixed | The chat sends at most the last 20 messages, always starting with the visitor's. The server refuses anything longer and says which field is wrong. |
| I5 | The chat hides itself mid-answer when the agent opens a panel | z.ai | The chat folded away as soon as any right-side panel opened, even one the agent opened while still answering. <br><br> **Before the Fix:** You ask for the order flow, it starts playing, and the rest of the answer vanishes into a small tab. <br><br> **After the Fix:** You read the whole answer, then the chat steps aside so you can watch the flow. | Fixed | The chat folds only after the answer finishes. Reopening it closes the panel but keeps the flow playing. |
| I6 | New chat and closing the panel during an answer aren't handled | z.ai, Claude (adversarial) | New chat did not stop an answer still being written, and closing the window could lose that answer. <br><br> **Before the Fix:** A fresh chat starts with a stray answer to no question, or a closed chat loses the half-written reply. <br><br> **After the Fix:** New chat is always clean, and closing the window mid-answer keeps the full reply. | Fixed | The shared chat memory owns the running answer. New chat stops it first; closing the window does not. |
| I7 | Error messages and token counts disappear in the new chat | grok, z.ai, Claude | The old panel showed errors and token use; the chat plan did not. A wrong key would show a green bot while every question failed silently. <br><br> **Before the Fix:** With a typo in the key the bot is green, you ask, and nothing happens. <br><br> **After the Fix:** The chat says plainly that the key was refused, and each reply shows its cost. | Fixed | Errors appear as chat messages and token counts under replies. The old "disconnect on a bad key" code is removed. |
| I8 | The setup window can't tell it is on the live site | grok, preplexity | The window should warn that answers only work locally, but the live site and a local run with no key got the same reply. <br><br> **Before the Fix:** The live site may skip its warning, or a local user sees the wrong hint. <br><br> **After the Fix:** Each visitor sees the right reason the bot is red and the right next step. | Fixed | The status check returns a separate reason for each case, and the window picks its text from it. |

## Design

Delivered in two increments, each shippable and demonstrable on its own. Increment 2 never
touches key handling.

### Increment 1 — Keyless server + red/green entry point

#### 1.1 Server: env-only keys, local only (I1, I8)
- **The local dev entry point turns the agent on (I1).** `server/scripts/dev-server.ts`:
  - `serve({ fetch: app.fetch, port: DEV_SERVER_PORT, hostname: '127.0.0.1' }, …)`. The API
    listens only on loopback. Vite's `/api` proxy already targets `localhost`, so
    `pnpm dev` is unchanged.
  - Sets `process.env.COSMOS_LOCAL_AGENT = '1'` *before* the dynamic `import('../src/app.js')`.
    This is the only place that sets it. It is not read from `.env` files: `getAgentConfig()`
    ignores a value that came from a file, because the dev script deletes any loaded
    `COSMOS_LOCAL_AGENT` and then sets it itself. So no deployed host can switch the agent on
    through configuration alone.
- New `server/src/agentConfig.ts` (replaces the cookie half of `config.ts`):
  `getAgentConfig(): { ok: true; config: AgentConfig } | { ok: false; reason: 'AI_NOT_LOCAL' | 'AI_NOT_CONFIGURED' }`
  with `AgentConfig = { provider: 'anthropic' | 'openai'; apiKey: string; gatewayApiKey: string | null }`.
  - `process.env.VERCEL` set **or** `COSMOS_LOCAL_AGENT !== '1'` → `{ ok: false, reason: 'AI_NOT_LOCAL' }`.
    The Vercel check is the backup (I1). Logged once at INFO, `errorCode: 'AI_DISABLED_NOT_LOCAL'`.
  - Local, but neither provider key set (whitespace-only counts as unset) →
    `{ ok: false, reason: 'AI_NOT_CONFIGURED' }`.
  - Provider precedence: `ANTHROPIC_API_KEY` wins over `OPENAI_API_KEY` when both are set
    (logged once at INFO, `errorCode: 'AI_PROVIDER_BOTH_SET'`).
  - `AI_GATEWAY_API_KEY` stays optional. Without it, classification uses the local keyword
    fallback.
  - Read on every call, never at import, so the map still starts with no AI env.
- `server/src/app.ts`:
  - `GET /ai/status` → `200 { connected: true, provider }` or `503 { errorCode: <reason> }`
    with the reason above (I8). It does not ping the provider. A bad key shows up on the first
    ask instead (1.5 / 2.4).
  - `POST /ai/ask` resolves `getAgentConfig()` instead of the cookie. If `ok: false`, it
    returns 503 with the same `errorCode`.
  - Delete `/ai/connect`, `/ai/disconnect`, `readAiCookie`, `clearAiCookie`, `cookieCrypto.ts`,
    `ConnectRequestSchema`, `getCookieSecret`.
  - `answerQuestion` / `createChatModel` take `AgentConfig` in place of `AiCookiePayload`
    (same three fields, so the factory body barely changes).
- Verify:
  - `server/src/__tests__/agentConfig.test.ts` (new, unit). Protects: `VERCEL` set ⇒
    `AI_NOT_LOCAL` even with keys and the flag set; flag missing ⇒ `AI_NOT_LOCAL`; local with no
    keys ⇒ `AI_NOT_CONFIGURED`; Anthropic wins when both are set; whitespace-only keys count as
    missing.
  - `server/src/__tests__/statusRoute.test.ts`, `askRoute.test.ts` (rewrite, route-level).
    Protects: 503 carries the right `errorCode` for each reason; ask streams with env keys; no
    cookie is read or set.
  - `server/src/__tests__/devServer.test.ts` (new, unit, imports a small exported
    `startDevServer` helper the script calls). Protects: binds `127.0.0.1`; sets
    `COSMOS_LOCAL_AGENT` itself even when an env file tried to set it.
  - Delete `connectRoute.test.ts`; trim `config.test.ts` to what remains.

#### 1.2 Client: remove inputs, bottom-right bot
- Remove the `AskAgent` input/textarea from the top bar and the mobile drawer
  (`client/src/App.tsx` header and `secondaryActions`). `AskAgent.tsx` becomes `AgentButton.tsx`:
  a round bot button with a chat-bubble look (speech-tail badge,
  `aria-label="Open the agent chat"`), keeping today's red / light-green status colours.
- **Phone first:** the button sits bottom-right *above* the playback bar and clear of the zoom
  buttons (`bottom: calc(var(--playback-h) + 12px)`), with a 48px tap target. Desktop uses the
  same corner and the same offset rule. Position rules live in
  `client/src/styles/responsive.css`.
- `useAiConnection` drops `connect`/`disconnect` and the "provider rejected the key →
  disconnect" branch (I7). Status is `unknown | connected | notLocal | notConfigured`, mapped
  from the 503 `errorCode` (I8).
- **A5 — keyboard toggle.** The global key handler in `App.tsx` (beside `p` for presentation)
  toggles the chat on `a`/`A`, but not while focus is in an input or textarea (same guard as
  `/` in `Spotlight.tsx`). When the bot is red it opens the setup window instead. Listed in
  `HelpModal.tsx` next to the existing shortcuts.
- Verify:
  - `client/src/components/__tests__/AgentButton.test.tsx` (rename of `AskAgent.test.tsx`,
    unit). Protects: red vs green class from status; clicking opens the right surface for each
    status.
  - `client/src/hooks/__tests__/useAiConnection.test.ts` (trim, unit). Protects: 503
    `AI_NOT_LOCAL` ⇒ `notLocal`, `AI_NOT_CONFIGURED` ⇒ `notConfigured`, 200 ⇒ `connected`;
    nothing calls a disconnect.
  - `client/src/__tests__/agentShortcut.test.tsx` (new, component). Protects: `a` toggles the
    chat; typing `a` in the composer or search does not; the shortcut is listed in help.
  - Manual: phone viewport 390×844 and 844×390. The button does not cover the play/zoom
    controls.

#### 1.3 Red → setup window (I8, A2)
- `ConnectAgentModal.tsx` loses every input and takes the status reason:
  - `notLocal` (live site): "Live answers are only available when running the project
    locally," followed by the setup steps.
  - `notConfigured` (local, no key): "No AI key is set yet," followed by the setup steps.
  - Setup steps, numbered, in fenced blocks: copy `server/.env.example` to `server/.env`, set
    `ANTHROPIC_API_KEY` *or* `OPENAI_API_KEY`, optionally `AI_GATEWAY_API_KEY` for JEV, then run
    `pnpm dev`.
  - **A2:** one line under the key step: "Questions are billed to the AI account whose key you
    set."
  - Has its own top-right close button (mobile close-button contract).
- Verify: `client/src/components/__tests__/ConnectAgentModal.test.tsx` (rewrite, unit).
  Protects: no input elements; env var names present; the live-site line appears only for
  `notLocal`; the billing note is present; close works.

#### 1.4 Removal of leftovers
- Delete: `cookieCrypto.ts`, `connectRequestSchema.ts`, `AI_COOKIE_SECRET` everywhere
  (`.env.example`, `scripts/fresh-start.mjs`, README), the visitor JEV key field, the joke
  answers in `AskPanel.tsx` and `server/src/agent/offTopicAnswers.ts` (replaced by the fixed
  reply in 2.2), the random-star fallback in `App.tsx`, and the key-rejected → disconnect
  handling (I7).
- `server/.env.example` documents exactly `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `AI_GATEWAY_API_KEY`, with the "local only, billed to this key" note. The `README.md` setup
  section is updated to match.
- Verify: `pnpm typecheck` + `pnpm lint` (catches unused imports and routes);
  `grep -r AI_COOKIE_SECRET` returns nothing outside `versions/`.

#### 1.5 Errors stay visible (I7, interim)
- Until Increment 2, the existing single-answer panel keeps rendering `providerErrors.ts` text,
  now that no disconnect follows it. Covered by `AskPanel.test.tsx` (existing): a provider
  401 shows the "key was refused" text while the bot stays green.

Increment 1 can be shown on its own: the live site is red and shows the "local only" window. A
local `.env` turns the bot green with the existing single-answer panel, and a bad key shows a
clear error.

### Increment 2 — Right-side chat

#### 2.1 Chat request contract (I4)
- One limit, counted in messages: `CHAT_MAX_MESSAGES = 20`.
- `server/src/schemas/askRequestSchema.ts`:
  ```ts
  ChatMessageSchema = z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) })
  AskRequestSchema  = z.strictObject({ messages: z.array(ChatMessageSchema).min(1).max(CHAT_MAX_MESSAGES) })
  ```
  plus refinements, each with a field-named error: the first and last messages are `user`;
  roles alternate; total characters ≤ `CHAT_TOTAL_MAX_CHARS = 8000`; the newest user message
  keeps the existing 500-char limit. The server **rejects** anything longer and never trims
  it. Strict objects reject `system`, `tool` and tool-call fields.
- **Client trimming** (`client/src/api/chatHistory.ts`, pure `toRequestMessages(history, question)`):
  takes the newest 19 messages plus the new question, then drops from the front until the first
  message is `user`, and then until total characters fit. So a long chat always sends a valid
  request, and the agent remembers "the last up-to-20 messages".
- Assistant turns from the client go to the model as plain `AIMessage` text, never as tool
  calls, so a crafted history cannot fake tool output.
- Verify:
  - `server/src/schemas/__tests__/askRequestSchema.test.ts` (new, unit). Protects: 21 messages
    rejected with `messages` named; starting with `assistant` rejected; `system`/`tool` roles,
    extra fields, non-alternating roles and over-length totals rejected.
  - `client/src/api/__tests__/chatHistory.test.ts` (new, unit). Protects: output is always ≤20,
    starts with `user`, alternates, and fits the character cap, for histories of 1–60 messages.
  - Route-level: `askRoute.test.ts` 400 cases name the field.

#### 2.2 Follow-up-aware routing
- `answerQuestion` receives `messages`. If `messages.length === 1`, classify it as today
  (`classifyQuestion` → `decideRoute`). Any later message skips classification and goes straight
  to the agent with the whole history: `graph.ts` seeds `state.messages` with the mapped history
  instead of a single `HumanMessage`.
- The first-message off-topic reply becomes one fixed, polite redirect with no random jokes:
  "I can only help with the AstroMart map — try asking about a service, a flow, or a team."
- Verify: `server/src/agent/__tests__/route.test.ts` + `classify.test.ts` (extend, unit).
  Protects: follow-ups are never classified and never get the off-topic reply.
  `graph.test.ts` (extend). Protects: history reaches the model in order.

#### 2.3 Allowed agent actions
- The agent's tool set is exactly, and only:
  - Map actions (`mapActionTools.ts`): `highlight_services`, `play_scenario`,
    `show_blast_radius`, `open_passport`, `show_health`, `show_ownership`, `open_changelog_entry`.
  - Read tools (`readTools.ts`): `get_service`, `get_steps`, `blast_radius`, `who_owns`,
    `on_call`, `drift`.
- Explicitly excluded: layout edit mode, layout reset, starting a demo, and anything that writes
  `localStorage`, cookies, or server data. No new tools in this plan.
- Export `AGENT_TOOL_NAMES` from `graph.ts`. Client `onAskAction` handles only the seven map
  action types; unknown types are ignored and logged at WARN.
- Verify: `server/src/agent/__tests__/graph.test.ts` (extend, unit). Protects: the bound tool
  names match the 13-name allow-list exactly, so adding a tool fails the test until the list is
  reviewed. `client/src/__tests__/askMapActions.test.tsx` (extend). Protects: no action touches
  layout storage.

#### 2.4 Chat state: `useAgentChat` (I3, I6, I7)
- `client/src/hooks/useAgentChat.ts`, owned by `App.tsx`, holds the messages **and the
  in-flight request** (its `AbortController`, streaming flag, partial reply). `AgentChat` only
  renders this state, so unmounting the window never aborts or loses a reply (I6).
- `send(question)` builds the request with `toRequestMessages` (2.1) and streams via
  `askStream.ts` (posts `{ messages }`). Map actions emitted mid-stream still run through
  `onAskAction`.
- `stop()` aborts the fetch; the server already passes the abort on. The partial reply is kept
  and marked `stopped: true`. When it goes into later requests, its content is
  `${partial}\n\n(reply stopped by the visitor)`, or just `(reply stopped by the visitor)` if it
  was empty. So it is never empty, roles still alternate, and the agent knows the reply was cut
  short (I3).
- `newChat()` calls `stop()` first, then clears the messages, so a late chunk can never land in
  the fresh chat (I6). Chunks are tagged with a per-request id, and chunks from an older id are
  dropped.
- **Errors and cost (I7):** a failed request appends an `error` message whose text comes from
  the existing `providerErrors.ts` mapping (e.g. "The AI provider refused the key in
  server/.env"), with a retry action. A finished reply stores its token usage, shown under the
  reply in small text (`1,240 tokens`), as the old panel did. Error messages are never sent back
  to the server.
- Verify: `client/src/hooks/__tests__/useAgentChat.test.ts` (new, unit, faked stream). Protects:
  - Stop before the first chunk, then ask again → the request is valid and contains the marker.
  - New chat during a stream → the abort is called and no late chunk appears.
  - Unmount mid-stream → the reply completes in state.
  - A 401 → an error message with the provider text, and the bot stays green.
  - Usage is stored per reply.

#### 2.5 Chat panel (I5, A3, A4)
- `AskPanel.tsx` becomes `AgentChat.tsx`: message list + composer, reusing the dormant
  `.lc-chat-*` styles in `client/src/styles/app.css`. It renders error messages as chat bubbles
  and token counts under replies (2.4).
- **Phone first:** full-width bottom sheet (max 75vh), with its own top-right close button. It
  joins the "One card at a time" block in `responsive.css` at the same priority as today's ask
  card.
- **Desktop:** docked right, 360px wide, below the top bar.
- **Layout rules (I5):**
  - If a right-side panel (step panel, health card, changelog) opens **while a reply is
    streaming**, the chat stays open. It collapses only once the reply finishes, to a slim
    right-edge tab showing the latest line and an unread dot.
  - Clicking the tab (or pressing `a`) reopens the chat and **closes that panel's card while
    leaving its state alone**: a playing scenario keeps playing and can be reopened from the
    playback bar as usual.
  - The side-by-side details card moves to the *left* while the chat is open (`Map.tsx` `fitTo`
    padding swaps to `left: 380, right: 380`).
- **A3 — "Thinking…" dots:** from send until the first chunk, the pending reply bubble shows
  three animated dots (`aria-label="The agent is thinking"`, honouring `prefers-reduced-motion`
  by showing static dots).
- **A4 — character counter:** once the draft passes 400 characters the composer shows
  `412 / 500`. At 500 the counter turns red and Send is disabled (the textarea also gets
  `maxLength=500`).
- Verify:
  - `client/src/components/__tests__/AgentChat.test.tsx` (rename/rewrite of `AskPanel.test.tsx`,
    unit). Protects: renders history and streamed reply; dots before the first chunk only;
    counter hidden ≤400, shown above, Send disabled at 500; error bubble and token line render;
    close button present.
  - `client/src/__tests__/chatLayout.test.tsx` (new, component). Protects: a panel opened
    mid-stream does not collapse the chat until the stream ends; reopening closes the panel card
    while the scenario stays playing; the details card switches sides.
  - Manual on 390px and desktop: ask for a flow and read the full answer, then watch the steps.

#### 2.6 Stop and New-chat buttons
- The composer shows **Stop** while streaming (`useAgentChat.stop()`). The header has
  **New chat** (`useAgentChat.newChat()`), which returns to the starter chips.
- Verify: `AgentChat.test.tsx`. Protects: Stop re-enables the composer and shows the reply as
  stopped; after New chat the next request has one message (and is classified again).

#### 2.7 Suggested follow-up chips
- After each finished reply, show 2–3 follow-up chips in the existing starter-chip style. They
  are built without extra model calls, from the last answer's map actions and mentioned ids
  ("Who owns {service}?", "What breaks if {service} fails?", "Play {scenario}"), by a pure
  `suggestFollowUps(lastAnswer, snapshot)` in `client/src/components/followUps.ts`. Tapping a
  chip sends it as the next user message.
- In a demo, the chips are the scripted ones instead (2.8), so a chip tap always matches the
  next scripted question (I2).
- Verify: `client/src/components/__tests__/followUps.test.ts` (new, unit). Protects: ≤3 chips,
  only ids that exist in the snapshot, none when nothing was mentioned.

#### 2.8 Demos answer from scripted turns (I2)
- **Data:** `aiTour` in `server/src/cosmos/data/demo.ts` becomes
  `aiTour.turns: [{ question, scriptedAnswer, actions: AskAction[], followUps: string[] }]`
  with 2–3 turns (Fulfillment changes → "Who owns shipping?" → follow-up chip tap).
  `validate.ts` checks that every `actions` id resolves, and that `turns[i].followUps[0]` equals
  `turns[i+1].question` exactly. Update the `aiTour` schema in `server/src/cosmos/schema.ts`, run
  `pnpm types:emit` and `pnpm fixture:cosmos`, and update `fixtures/baseline-full.json`.
- **Answering:** `useAgentChat` takes an optional `scriptedTurns` source. While a demo runs
  (`useDemoAiConnection` reports `connected` with the demo flag), `send(question)` does not call
  the server. It finds the turn whose `question` matches, streams its `scriptedAnswer` with the
  same chunk timing as `client/src/demo/scriptedAnswer.ts`, runs each of its `actions` through
  `onAskAction`, and offers its `followUps` as chips. If no turn matches (which the validator
  rules out), it shows a fixed "This demo only knows its scripted questions" message rather than
  calling the server. This replaces today's `handleAsk` demo branch in `App.tsx`.
- **Scripts:** the Connect / paste-key steps are removed. `buildAiDemoScript()` and the AI
  segment of `buildAllDemoScript()` click the bot, type, send, then tap the first follow-up chip,
  all as real UI gestures on new `data-demo-target`s (`agent-button`, `agent-composer`,
  `agent-send`, `agent-followup-0`). The phone variant comes from
  `buildDemoScript(mode, { isPhone })`.
- Verify:
  - `client/src/demo/__tests__/scripts.test.ts`. Protects: ai ≤60s, all ≤120s.
  - `demoTargets.test.tsx`. Protects: every target exists.
  - `useAgentChat.test.ts` (scripted mode). Protects: no `fetch` is made; each turn's actions
    fire; chips equal `followUps`.
  - `server/src/__tests__/demoData.test.ts` + `validate` tests. Protects: the turns shape; the
    chip-to-next-question match.
  - Re-record both modes with `pnpm record:demo ai|all`.

#### 2.9 A1 — Browser tests for the chat and the demo chat
- `e2e/agent-chat.spec.ts` (new, Playwright, uses the existing `e2e/playwright.config.ts` web
  server):
  - **Demo:** open `/?demo=ai` with no AI env. Assert the bot is green, the scripted question
    and answer appear, a highlighted service shows on the map, the follow-up chip produces the
    second answer, and no request hits `/api/ai/ask`.
  - **Chat:** `page.route('**/api/ai/status')` → 200 and `page.route('**/api/ai/ask')` → a faked
    stream. Then: ask → follow-up chip → second ask (assert the request body has 3 messages) →
    Stop mid-stream (assert the stopped marker) → New chat (assert the next body has 1 message).
  - **Phone:** the same chat flow at 390×844, asserting the sheet's close button and that the bot
    does not overlap the playback bar.
- Protects the whole chain the unit tests cover separately: button → chat → request contract →
  map reaction → demo. It runs in `pnpm test:e2e` and in the final `/test`.

### Known accepted gaps
- No issue was ignored. The one deliberate limitation: the live site never answers with real AI.
  Visitors there see the "local only" setup window and the scripted demos.
- A bad key is found on the first question, not by the status check. The bot stays green until
  then, but the error is shown plainly in the chat (I7).

### Final acceptance
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm validate`, `pnpm test:e2e`
  all green (`/test`). `pnpm types:emit` leaves no diff.
- End to end, locally, on a 390px viewport first, then desktop:
  - With an empty `.env`, the bot is red and the window says "No AI key is set yet".
  - After adding `ANTHROPIC_API_KEY`, the bot is green. Ask a question (dots, then the reply
    with its token count), follow up with a chip, play a scenario from the chat (the chat folds
    only after the reply), and press `a` to reopen it.
  - Then: Stop, ask again, New chat during a stream, close and reopen mid-stream (the reply is
    complete).
  - With a deliberately wrong key, the chat shows the "key refused" message.
- With `VERCEL=1 pnpm dev:server` and keys set, `/api/ai/status` returns 503 `AI_NOT_LOCAL`.
  Running `server/src/app.ts` under any entry point other than the dev script returns the same.
- `curl http://<lan-ip>:8787/api/ai/status` from another device is refused.
- `README.md` updated (removed inputs, keyless setup, env vars, the `A` shortcut); version note
  written.

## ➕ Additions to the Project (5): 0 🟣 | 0 🔴 | 1 🟡 | 4 🔵 | 0 🟠

> All additions below were **accepted into this plan** (`--additions`) and are designed in
> `## Design` — `/spec`, `/master` and `/orca` build them as part of it.
>
> **Session %** is the share of one 5-hour session's 15,000,000-token allowance an AI agent
> would burn implementing that addition end to end (see `~/.claude/skills/_lib/session-cost-model.md`).

| # | Category | Value | Conf | Title | Detected by | Size | Session % | Description |
|---|----------|-------|------|-------|-------------|------|-----------|-------------|
| A1 | Testing | 🟡 Medium value | C3 | Browser test for the chat and the demo chat | gpt, preplexity | S | 3% | One Playwright test plays `?demo=ai` with no AI key, and one runs ask → follow-up → Stop → New chat with a faked answer stream. <br><br> **Before Add:** Each piece passes its own tests while the whole chat or the demo can still be broken. <br><br> **After Add:** One run proves the chat and the public demo work from start to finish. |
| A2 | UX | 🔵 Low value | C3 | Note that local answers use your own AI account | gpt | XS | 1% | Add one line to the setup window saying questions are billed to the key you configure. <br><br> **Before Add:** Someone sets their key without realizing each question costs money. <br><br> **After Add:** They know up front that chatting uses their own paid account. |
| A3 | UX | 🔵 Low value | C2 | "Thinking…" dots before the first word | z.ai | XS | 1% | Show small animated dots in the chat from sending until the first word arrives. <br><br> **Before Add:** After sending, the chat sits still for a few seconds. <br><br> **After Add:** You see right away that the agent is working. |
| A4 | UX | 🔵 Low value | C3 | Character counter near the 500-character limit | z.ai | XS | 1% | Show "412 / 500" once a question passes 400 characters, and disable Send at the limit. <br><br> **Before Add:** A long question is sent and then refused with an error. <br><br> **After Add:** You see the limit coming and trim before sending. |
| A5 | UX | 🔵 Low value | C2 | Keyboard key to open and close the chat | grok | XS | 1% | One key (e.g. `A`) toggles the chat, like `/` opens search, listed in the keyboard help. <br><br> **Before Add:** Opening the chat always needs a click or tap. <br><br> **After Add:** Keyboard users open and close it in one keystroke. |

**Added to this plan: ~7% of a 5h session.**
