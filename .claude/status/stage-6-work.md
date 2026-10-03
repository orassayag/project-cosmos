# Stage 6 work brief — AgentChat panel: phone sheet / desktop dock, collapse-after-answer layout, Stop/New chat, thinking dots, counter, follow-up chips (2.5, 2.6, 2.7, A3, A4)

Plan: docs/plans/ai-refactor.md. Stage plan line: Stage 6 — ⚠ large (~700 LOC). Paste of the plan sections in scope follows.

## Plan context (Summary + Scope)
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

## Plan sections in scope
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


## Related (already built in stage 5 — consume, don't rebuild)
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


## Additions in scope (A3, A4)
| A3 | UX | 🔵 Low value | C2 | "Thinking…" dots before the first word | z.ai | XS | 1% | Show small animated dots in the chat from sending until the first word arrives. <br><br> **Before Add:** After sending, the chat sits still for a few seconds. <br><br> **After Add:** You see right away that the agent is working. |
| A4 | UX | 🔵 Low value | C3 | Character counter near the 500-character limit | z.ai | XS | 1% | Show "412 / 500" once a question passes 400 characters, and disable Send at the limit. <br><br> **Before Add:** A long question is sent and then refused with an error. <br><br> **After Add:** You see the limit coming and trim before sending. |

## Out of this stage
- 2.8 scripted demo turns (aiTour.turns data, scripted answering, demo targets rename connect-open → agent-button) is stage 7. 2.9 / A1 Playwright spec + final README acceptance pass is stage 8.
- Keep the existing demo tours working (pnpm test incl. demo scripts tests must pass). Demos currently drive AskPanel's `ask-input` / `ask-search` targets; keep equivalent `data-demo-target` attributes on the new composer so the current tours still run, and keep the scriptedAnswer path working until stage 7 replaces it.
- Stage 3 note: `toggleAgent` in App.tsx (A key) must be repointed at the new chat panel (connected branch) — in scope here (plan 2.5 'Clicking the tab (or pressing a) reopens the chat').
- Stage 2 note: on 844×390 landscape the question box sat below the fold of the bottom sheet — pin the composer.
- README: update the Ask the agent section if the visible behaviour changed (chat, Stop/New chat, chips, counter).
