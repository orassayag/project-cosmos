# Stage 8 report — agent-chat browser tests + final acceptance pass

## Files
e2e/agent-chat.spec.ts
README.md
client/src/components/ConnectAgentModal.tsx
client/src/components/__tests__/ConnectAgentModal.test.tsx
client/src/styles/app.css

## Summary
- New `e2e/agent-chat.spec.ts` with three Playwright tests:
  - **Demo:** `/?demo=ai` with no AI env. Bot dot is `lc-status-dot--on`; both scripted questions and answers appear; `shipping` stays undimmed while other services dim; the follow-up chip gives the second answer; the tour reaches `data-demo-state="done"`; zero requests to `/api/ai/ask`.
  - **Chat (desktop):** `/api/ai/status` mocked 200, `/api/ai/ask` mocked with real NDJSON lines (`token` / `action` highlight / `usage` / `done`). Ask → token count `≈ 1,280 tokens` → chip "Who owns payments?" → body has exactly 3 messages (checked content) → a held request → Stop → "Reply stopped" → New chat → next body has 1 message. `payments` ends up undimmed.
  - **Phone (390×844, touch):** with a scenario loaded and the step strip closed, the bot sits fully above the playback bar. Then the same chat flow, then the sheet's "Close the chat" button is in the top-right and closes the sheet.
- Stage-6 leftovers: "answer panel" wording in `ConnectAgentModal.tsx` comment and its test name/harness label now say "agent chat". Removed the unused `.lc-chat-trigger` CSS and its orphan header comment.
- README: `pnpm test:e2e` rows now say they drive the agent chat (desktop + phone, faked agent) and the `?demo=ai` tour; test list mentions the agent chat; "One panel at a time" says "agent chat" instead of "ask". The rest of the AI/README sections already matched shipped behaviour (no ask input, keyless setup window, env vars, `A` shortcut, chat, demo tours).

Verification (all run by me, verified):
- `pnpm typecheck` green. `pnpm lint` green (1 pre-existing warning, `client/src/map/Map.tsx:836`). e2e specs are outside both workspaces' tsconfig, so I also ran an ad-hoc strict `tsc --noEmit` and `eslint e2e` on them: clean.
- `pnpm test` green: server 369/369, client 304/304, scripts 11/11.
- `pnpm validate` green (0 errors, 0 warnings). `pnpm build` green. `pnpm types:emit` leaves no diff.
- `pnpm test:e2e` (via `BASE_URL`, see Open questions): 7/7 passed, and 14/14 with `--repeat-each=2` (no flakes). demo=ai test runs ~26.5s.
- Server checks (scratch probe, deleted after): `startDevServer` with `VERCEL=1` and a fake key → `/api/ai/status` 503 `AI_NOT_LOCAL`; same without `VERCEL` → 200 connected; importing `server/src/app.ts` directly (no dev script) with a key → 503 `AI_NOT_LOCAL`. `curl http://10.0.0.12:8787/api/ai/status` (this machine's LAN IP) → connection refused, since the dev server listens on 127.0.0.1 only.
- No background processes left from this stage (my temporary Vite on :5199 was stopped).

## Commit message
test(e2e): cover the agent chat and the demo chat in Playwright

The unit tests check the chat's pieces one by one; this spec checks the whole
chain in a real browser: bot, chat, request contract, map reaction, and demo=ai.
Also drops leftover "answer panel" wording and the unused chat-trigger CSS.

## Key decisions
- "Stop mid-stream" is a request held open by the route mock, not a half-sent body. `route.fulfill` sends the body in one piece, so a partial-token stream is not possible with `page.route`. The test proves Stop on an in-flight request shows "Reply stopped"; the partial-text case stays covered by `useAgentChat` unit tests.
- The phone overlap check needs the playback bar on screen, so it loads `?scenario=<first ready>`. On phones the step narration strip hides the bot (by design), so the test closes the strip first, then checks the bot's bottom edge is above the bar's top edge.
- Highlight is asserted through the existing `data-dimmed` attribute on `g.lc-service-node`; no new test ids were added to app code.
- No demo=all segment added (brief: ~3.7s headroom). No behaviour change, so no demo re-recording.
- Did not edit `CLAUDE.md`, though its `pnpm test:e2e` comment ("loads the map via /api/cosmos") is now incomplete — out of this stage's file scope. One-line follow-up if wanted.

## Open questions
- **Stale dev servers block plain `pnpm test:e2e` on this machine.** An old Vite from Sep 25 (pid 23408) holds :5173 and answers 404 for `/api/cosmos`; another old Vite (Oct 1, pid 36483) holds :5174. Playwright then tries to start `pnpm dev`, which cannot bind, and times out. I did not kill processes I did not start. I ran the suite against my own Vite on :5199 (`BASE_URL=http://localhost:5199`), using the already-running current API dev server on :8787. Kill those two old Vite processes, then `pnpm test:e2e` should work as-is.
- Manual checks for the user (need a real key or a second device; NOT verified here):
  - 390px first, then desktop: empty `.env` → bot red, window says "No AI key is set yet".
  - With `ANTHROPIC_API_KEY`: bot green; ask (dots, then reply with token count); follow-up chip; play a scenario from the chat (chat folds only after the reply); press `a` to reopen.
  - Stop, ask again, New chat during a stream, close and reopen mid-stream (reply complete).
  - Wrong key → chat shows the "key refused" message.
  - `curl http://<lan-ip>:8787/api/ai/status` from another device is refused (only checked from this same machine).
