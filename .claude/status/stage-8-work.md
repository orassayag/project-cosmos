# Stage 8 work brief — Playwright agent-chat spec + final README/acceptance pass (2.9, A1)

Plan: docs/plans/ai-refactor.md. This is the FINAL stage.

## Plan §2.9 — A1 — Browser tests for the chat and the demo chat (pasted verbatim)
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

## Plan — Known accepted gaps (pasted verbatim)
- No issue was ignored. The one deliberate limitation: the live site never answers with real AI.
  Visitors there see the "local only" setup window and the scripted demos.
- A bad key is found on the first question, not by the status check. The bot stays green until
  then, but the error is shown plainly in the chat (I7).

## Plan — Final acceptance (pasted verbatim)
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

## Stage scope (orchestrator notes)
- Build `e2e/agent-chat.spec.ts` per §2.9. Use the real demo targets / test ids from the code
  (stage 7 renamed: `agent-button`, `agent-composer`, `agent-send`, `agent-followup-0`;
  thinking dots `aria-label="The agent is thinking"`; Send `aria-label="Send"`). Read the
  faked stream wire format from `client/src/components/askStream.ts` — do not guess it.
- Run the automatable part of Final acceptance: build, typecheck, lint, test, validate,
  test:e2e, `pnpm types:emit` leaves no diff. Also the automatable server checks
  (`VERCEL=1` dev server → `/api/ai/status` 503 `AI_NOT_LOCAL`; non-loopback bind refused)
  if they can be done without a real AI key and without leaving processes running.
  Items that need a real API key or a second device are NOT doable here — list them under
  Open questions as manual checks for the user; do not claim them.
- Final README pass: confirm README matches the shipped behaviour (no ask input in top bar/drawer,
  keyless setup window, env vars, `A` shortcut, chat, demo tours, `pnpm test:e2e` now covering the
  chat). Fix only stale lines. Clean up stage-6 leftovers if trivially in scope: stale
  "answer panel" wording in `ConnectAgentModal.tsx` comment/test name, unused `.lc-chat-trigger` CSS.
- CLAUDE.md invariants: AI change → `demo=ai` must reflect it (no behaviour change expected here);
  demo=all has ~3.7s headroom vs 120s — do NOT add a demo segment in this stage.
- Do not write the version note (orchestrator does it at commit).
