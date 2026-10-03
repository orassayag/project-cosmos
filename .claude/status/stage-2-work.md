# Stage 2 work brief — Client entry point

Plan: docs/plans/ai-refactor.md · Branch: feature/ai-refactor
Stage scope: plan §1.2 (except A5), the **client half** of §1.4, and §1.5.

## Boundaries for this stage
- Client only. Stage 1 already made the server keyless (see the ledger). The client still calls
  `/ai/connect` / `/ai/disconnect`, which now 404 — this stage removes those calls.
- **A5 (the `a`/`A` keyboard toggle, its `HelpModal.tsx` entry, and
  `client/src/__tests__/agentShortcut.test.tsx`) is stage 3 — do not build it here.**
- **§1.3 (setup window wording by reason, setup steps, billing note A2, the
  `ConnectAgentModal.test.tsx` rewrite) is stage 3.** In this stage, touch
  `ConnectAgentModal.tsx` only as far as removing `connect`/`disconnect` from `useAiConnection`
  forces it to (e.g. drop the key inputs, the visitor JEV key field, and the Connect/Disconnect
  submit path) so the build and its existing test stay green; keep its close button. Adjust its
  test only as far as needed.
- `.env.example`, `scripts/fresh-start.mjs`, README docs are stage 3. The right-side chat
  (`useAgentChat`, `AgentChat`) is stage 5/6. Demo scripted turns are stage 7.
- Until the chat lands (Increment 2), **green must still open the existing single-answer
  panel and let the user ask a question there** (plan: "A local `.env` turns the bot green
  with the existing single-answer panel, and a bad key shows a clear error"). If the question
  input only lived in the top bar `AskAgent`, give the existing `AskPanel` the minimal input it
  needs to ask — do not build the chat.
- Demo tours (`client/src/demo/scripts.ts`) target `data-demo-target`s. If removing the top-bar
  input breaks a demo step or `scripts.test.ts`, make the smallest change that keeps the tours
  working and `pnpm test` green (e.g. retarget to the bot button / panel input), and note it
  under `## Open questions` — the full demo rework is stage 7.
- Mobile-first + one-panel-at-a-time + mobile close-button contract (see CLAUDE.md) apply.

## Plan §1.2 (verbatim)
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
- **A5 — keyboard toggle.** [STAGE 3 — NOT THIS STAGE] The global key handler in `App.tsx`
  (beside `p` for presentation) toggles the chat on `a`/`A`, but not while focus is in an input
  or textarea (same guard as `/` in `Spotlight.tsx`). When the bot is red it opens the setup
  window instead. Listed in `HelpModal.tsx` next to the existing shortcuts.
- Verify:
  - `client/src/components/__tests__/AgentButton.test.tsx` (rename of `AskAgent.test.tsx`,
    unit). Protects: red vs green class from status; clicking opens the right surface for each
    status.
  - `client/src/hooks/__tests__/useAiConnection.test.ts` (trim, unit). Protects: 503
    `AI_NOT_LOCAL` ⇒ `notLocal`, `AI_NOT_CONFIGURED` ⇒ `notConfigured`, 200 ⇒ `connected`;
    nothing calls a disconnect.
  - `client/src/__tests__/agentShortcut.test.tsx` [STAGE 3 — NOT THIS STAGE]
  - Manual: phone viewport 390×844 and 844×390. The button does not cover the play/zoom
    controls. (Report what you verified; if you cannot drive a browser, say so plainly.)

## Plan §1.4 (verbatim — this stage does the CLIENT items only)
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

Client items for THIS stage: the visitor JEV key field (client side), the joke answers in
`AskPanel.tsx`, the random-star fallback in `App.tsx`, and the key-rejected → disconnect
handling. Server items (cookieCrypto, connect schema, AI_COOKIE_SECRET reads in server/src) are
done (stage 1). `.env.example` / `fresh-start.mjs` / README are stage 3.
`server/src/agent/offTopicAnswers.ts` is stage 4 — do not touch it. Also remove any
`AI_COOKIE_SECRET` mention left in `client/`.

## Plan §1.5 (verbatim)
#### 1.5 Errors stay visible (I7, interim)
- Until Increment 2, the existing single-answer panel keeps rendering `providerErrors.ts` text,
  now that no disconnect follows it. Covered by `AskPanel.test.tsx` (existing): a provider
  401 shows the "key was refused" text while the bot stays green.

Increment 1 can be shown on its own: the live site is red and shows the "local only" window. A
local `.env` turns the bot green with the existing single-answer panel, and a bad key shows a
clear error.

## Context from the plan summary
A bot button sits bottom-right and stays red (not connected) or green (connected). Red opens a
window that explains how to set up the agent and JEV locally. Green opens (eventually) a
right-side chat; for now, the existing single-answer panel.

## Required checks
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` — all green. Never run `tsc` without
`--noEmit`/`-b`.
