# Stage 3 work brief — Keyless setup window by reason + billing note, A-key toggle + help, .env.example / fresh-start / README

Plan: docs/plans/ai-refactor.md (plan items 1.3, A2, A5, docs half of 1.4). No spec for this run.

## Plan sections (pasted verbatim)

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


### Addition A2 (accepted)
| A2 | UX | 🔵 Low value | C3 | Note that local answers use your own AI account | gpt | XS | 1% | Add one line to the setup window saying questions are billed to the key you configure. <br><br> **Before Add:** Someone sets their key without realizing each question costs money. <br><br> **After Add:** They know up front that chatting uses their own paid account. |

### Addition A5 (accepted)
| A5 | UX | 🔵 Low value | C2 | Keyboard key to open and close the chat | grok | XS | 1% | One key (e.g. `A`) toggles the chat, like `/` opens search, listed in the keyboard help. <br><br> **Before Add:** Opening the chat always needs a click or tap. <br><br> **After Add:** Keyboard users open and close it in one keystroke. |

### Final acceptance (README line — this stage owns the README parts listed)
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


## Stage-3 scope, as cut by the stage plan
1. **1.3 + A2 — setup window by reason.** `ConnectAgentModal` takes the status reason
   (`notLocal` | `notConfigured`; decide how `unknown` renders — `notLocal` wording is the safe
   default) from `useAiConnection` via `App.tsx`. Wording, numbered fenced setup steps, billing
   note, own top-right close button. Rewrite `ConnectAgentModal.test.tsx` per the "Protects" list.
   Remove the now-dead `.lc-connect-form*` CSS in `client/src/styles/app.css` (left over by stage 2).
   Mobile-first: verify at ~390px and short landscape, then desktop; one-panel-at-a-time policy.
2. **A5 — `A` key toggles the agent.** Follow the existing keyboard-shortcut handling (find where
   `/` opens search and where the help/keyboard list lives — README "Driving it from the keyboard"
   and the in-app help panel). `a`/`A` (ignored while typing in an input/textarea, and with
   modifiers) toggles: when the bot is green it opens/closes the answer panel (same path as
   clicking the bot, `handleOpenAgentChat`); when red/grey it opens/closes the setup window. Add
   it to the in-app keyboard help and its test. Stage 6 will repoint it at the new chat panel.
3. **Docs half of 1.4.** `server/.env.example` documents exactly `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY`, `AI_GATEWAY_API_KEY` with the "local only, billed to this key" note; remove
   `AI_COOKIE_SECRET` from every `.env.example`, `scripts/fresh-start.mjs` and `README.md`.
   `grep -r AI_COOKIE_SECRET` must return nothing outside `versions/` (and `docs/` history files
   if any — report them, do not edit `versions/`).
   README: rewrite the AI bullet under "What's in the box", the "Ask the agent (AI)" →
   "Connecting" section (bot red/green, setup window by reason, keys in `server/.env`, local
   only, billed note), the "Server API" table (drop `/api/ai/connect` and `/api/ai/disconnect`;
   `/api/ai/status` returns 200 `{ connected, provider }` or 503 `AI_NOT_LOCAL`/`AI_NOT_CONFIGURED`),
   the `demo=ai` line (no connect step now), the Mobile drawer line (no Ask in the drawer), the
   Project layout comments (Ask box/Connect window → agent button/setup window), the Deployment
   paragraph (no `AI_COOKIE_SECRET`; AI is always off when deployed), the Testing paragraph (no
   cookie crypto), and add the `A` shortcut to the keyboard section. Keep everything else.
   Don't describe the stage-5/6 chat yet — describe what exists after this stage.

## Context from stage 2 (see ledger)
- `ConnectAgentModal()` currently takes no props; static "The agent runs locally" window with
  close button, Escape and overlay stacking.
- `useAiConnection` → `{ status: 'unknown'|'connected'|'notLocal'|'notConfigured', provider }`.
- Bot (`AgentButton`) red/grey → `OVERLAY.connect`; green → `handleOpenAgentChat`.
- Open question from stage 2: grey `unknown` bot opens the setup window — keep that, but make
  sure the window's text is sensible for `unknown` (decide and record in Key decisions).

## Out of scope for this stage
Chat request contract, routing, `offTopicAnswers.ts` (stage 4); chat hook/panel (5/6); demo
scripted turns and the `connect-open` → `agent-button` rename (7); Playwright spec (8).
Do not re-record demos.
