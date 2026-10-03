## Files
client/src/components/ConnectAgentModal.tsx
client/src/components/__tests__/ConnectAgentModal.test.tsx
client/src/components/HelpModal.tsx
client/src/App.tsx
client/src/styles/app.css
client/src/__tests__/agentShortcut.test.tsx
server/.env.example
README.md

## Summary
The setup window now takes the AI status and has no inputs. Its first line gives the reason ("Live answers are only available when running the project locally." for `notLocal`/`unknown`, "No AI key is set yet." for `notConfigured`). Below that come four numbered steps, each in a code block (copy `server/.env.example` to `server/.env`, set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, optionally `AI_GATEWAY_API_KEY`, run `pnpm dev`), with the A2 billing note under the key step. The window keeps its own close button in the top-right corner. Pressing `A` (ignored with Cmd/Ctrl/Alt or while typing) opens and closes the agent: the answer panel when the bot is green, the setup window otherwise. `A` is listed in the in-app help and the README keyboard table. The dead `.lc-connect-*` form CSS is gone. `server/.env.example` now lists exactly the three keys, with the local-only and billing note. The README AI bullet, the Ask/Connecting section, the triage diagram wording, the Server API table, the `demo=ai` line, the Mobile drawer line, the Project layout comments, Deployment, Testing and the Tech notes cookie mention are all updated. `AI_COOKIE_SECRET` is gone from everything outside `versions/`, `docs/` history and `.claude/status/`. `scripts/fresh-start.mjs` never referenced it, so it was not changed.
Results: `pnpm typecheck` passes. `pnpm lint` has 0 errors and 1 warning that was already there (`client/src/map/Map.tsx:834`). `pnpm test` passes (client 27 files / 194 tests, server 28 / 339, scripts 11). `pnpm build` and `pnpm validate` pass. Playwright headless against my own dev server (client :5199, server :8787, both stopped afterwards) checked 390×844, then 844×390, then 1440×900. At each size the window shows the right reason line for `notConfigured` (real server) and `notLocal` (mocked route), has no inputs, stays inside the viewport with no horizontal scroll, shows no other panel and keeps its close button visible in the top-right corner. The close button closes it, and `A` opens and closes it. With a mocked connected status, `A` opens and closes the answer panel. On 844×390 the window scrolls inside itself (88dvh).

## Commit message
feat(client): explain keyless agent setup by reason and add A shortcut

The setup window now says why the bot is red: live site or no key yet.
It lists the env-file steps and notes that questions are billed to the key you set.
A toggles the agent from the keyboard; docs and .env.example drop the cookie secret.

## Key decisions
- `ConnectAgentModal({ status: AiConnectionStatus })`. It takes the full status, not just a reason: `notConfigured` gets the no-key wording and every other value (`notLocal`, `unknown`, and `connected`, which is unreachable) gets the live-site wording. That wording is true for any visitor whose status has not answered yet. The reason line has `data-testid="connect-reason"`.
- The `A` toggle lives next to the `P` handler in the shell in `App.tsx` (`toggleAgent`). When connected, it closes `OVERLAY.ask` if that is open, otherwise it calls `onOpenAgentChat` (the same path as clicking the bot). When not connected, it calls `overlay.toggle(OVERLAY.connect)`. **Stage 6 should repoint the connected branch at the new chat panel.** The footer hint row was not changed (help modal and README only).
- The setup steps are fixed to the plan's list. For live-site visitors there is no "clone the repo" step; the README Quickstart covers that.
- README: the "How a question is answered" diagram and bullets said "visitor's key". I reworded them to "configured key" because they were now wrong. The off-topic "canned playful reply" line stays until stage 4. "Run with AI locally" was not changed (the orchestrator already updated it).
- The App-level `A` test lives in a new file, `client/src/__tests__/agentShortcut.test.tsx`. There was no existing HelpModal test, so the help-listing check is there too.
- Remaining `AI_COOKIE_SECRET` mentions are only in history and working files: `docs/plans/add-ai.md`, `docs/plans/ai-refactor.md`, `docs/status/ledger.md`, `.claude/status/stage-*`. Left as they are.
- Demos were not re-recorded (out of scope). `data-demo-target="connect-open"` was not changed.
