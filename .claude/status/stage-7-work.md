# Stage 7 work brief — Scripted demo turns: aiTour.turns data + validator + schema/types/fixtures, scripted answering, demo scripts on new targets (2.8)

Plan: docs/plans/ai-refactor.md. Stage plan line: Stage 7. No spec file for this run. Paste of the plan sections in scope follows.

## Plan context (Summary + Scope + Issue Resolutions)
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


## In-scope section
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


### Known accepted gaps
- No issue was ignored. The one deliberate limitation: the live site never answers with real AI.
  Visitors there see the "local only" setup window and the scripted demos.
- A bad key is found on the first question, not by the status check. The bot stays green until
  then, but the error is shown plainly in the chat (I7).


## Stage boundaries
- Stage 8 (next) owns the Playwright agent-chat spec (2.9, A1) and the final README/acceptance pass. Do not write Playwright specs here.
- Stage 6 left `useAgentChat.sendScripted(question, answer)` as a stop-gap for the demo; this stage replaces it with `scriptedTurns` and removes the stop-gap and the `handleAsk` demo branch in `App.tsx`.
- Stage 2 kept `data-demo-target="connect-open"` on the bot on purpose; this stage renames it to `agent-button` and adds `agent-composer`, `agent-send`, `agent-followup-0` (replacing `ask-input` / `ask-search` where the plan calls for it).
- Project invariants (CLAUDE.md): tours drive the real UI only (no step sets app state); ai tour ≤60s, all tour ≤120s; after a data edit run `pnpm fixture:cosmos`, update `fixtures/baseline-full.json`, and `pnpm types:emit`; demo data stays fictional (AstroMart). Re-record both demo modes with `pnpm record:demo ai|all` if the environment allows; if it cannot run, say so in the report.
