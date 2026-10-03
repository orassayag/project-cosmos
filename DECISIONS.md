# Decisions

The per-feature decision log — newest first. One entry per finalized plan, written when
the feature lands: `/master approve` on the final stage, the end of an `/orca` run, or
`/publish`. Each entry records which review recommendations (R1, R2, …) were accepted
and which were not, when, and why — including the pain point behind each one.
Per-commit history lives in `versions/`; that is the *what*, this file is the *why*.

<!-- decisions:entries -->

## Keyless multi-turn agent chat — 2026-10-03
<!-- plan: docs/plans/ai-refactor.md -->
**Plan:** `docs/plans/ai-refactor.md` · **Landed via:** /master approve · **Version:** v2.7.1

**Why this feature:** "Ask the Agent" was a single-question panel that asked visitors for their own API keys. It is now a multi-turn chat that needs no visitor keys: the server reads keys from its own `server/.env` and answers only when the owner runs it locally, and the demos show a scripted conversation so the live site needs no AI key.

| # | Decision | Status | Why | Pain point behind it |
|---|----------|--------|-----|----------------------|
| R1 | Dev server listens only on this computer; only the local dev script switches the agent on (Vercel check kept as backup) | ✅ Selected | Real answers must only come from the owner's machine | Someone on the same Wi-Fi, or another host running the project, could run up the owner's AI bill |
| R2 | During a demo, answers come from scripted turns with their map effects; each follow-up chip matches the next scripted question | ✅ Selected | The live site has no AI server, so the demo must answer on the client | The demo would get an error on the live site, or a reply with nothing lighting up on the map |
| R3 | A stopped reply is sent back with a short "stopped" note | ✅ Selected | Keeps it non-empty so turns still alternate | After pressing Stop, every later question errored until a new chat |
| R4 | Send at most the last 20 messages, always starting with the visitor's; the server refuses longer and names the bad field | ✅ Selected | One clear limit everyone builds to | Long chats could suddenly fail, or the agent forgot different things depending on who built it |
| R5 | The chat folds only after the answer finishes; reopening it closes the panel but keeps the flow playing | ✅ Selected | The visitor reads the whole answer, then watches the flow | The answer vanished into a small tab as soon as the agent opened a panel |
| R6 | The shared chat memory owns the running answer; New chat stops it first, closing the window does not | ✅ Selected | New chat is always clean and no reply is lost | A fresh chat could show a stray answer, or closing lost the half-written reply |
| R7 | Errors appear as chat messages and token counts under replies; the old "disconnect on a bad key" code is removed | ✅ Selected | A wrong key must be visible, and each reply shows its cost | With a typo in the key the bot was green and questions failed silently |
| R8 | The status check returns a separate reason (not local / not configured) and the setup window picks its text from it | ✅ Selected | Each visitor sees the right reason and next step | The live site and a local run with no key got the same message |
| D1 | Only a chat's first message is classified; follow-ups go straight to the agent with full history | ✅ Selected | Stated in the plan's Design (follow-up-aware routing) | A follow-up like "who owns it?" would be judged off-topic on its own |
| D2 | Phone demo turns drop every surface-opening action and keep highlights | ✅ Selected | Panels must not stack on phones (one card at a time) | Not recorded |
| D3 | Turn 2 of the AI demo highlights the team instead of showing the ownership legend | ✅ Selected | The ownership legend overlapped the shipping passport on desktop | Two cards drawn over each other in the demo |
| D4 | The e2e test checks Stop on a held-open request, not a half-streamed body | ✅ Selected | Playwright's route mock cannot stream a partial body; partial-text stop stays covered by unit tests | Not recorded |

## Server-owned data migration — 2026-10-03
<!-- plan: docs/plans/server-owned-data-migration-plan.md -->
**Plan:** `docs/plans/server-owned-data-migration-plan.md` · **Landed via:** /master approve · **Version:** v1.42.0

**Why this feature:** The map's data lived inside the web app and the AI agents only saw a partial snapshot of it, so the agent and the map could disagree and the AI demo had to fake its answer. The server now owns all the data and every computed fact, and both the map and the agents read the same view.

| # | Decision | Status | Why | Pain point behind it |
|---|----------|--------|-----|----------------------|
| R1 | Move the no-account local dev setup (Node server + Vite `/api` proxy) into Phase 7 | ✅ Selected | Every check from Phase 7 on needs the app running locally | Halfway through the migration the app showed only an error locally, and forks needed a Vercel account |
| R2 | Forget a failed data request so Retry really refetches | ✅ Selected | The Phase 7 "Retry recovers" check could not pass otherwise | Once loading failed, Retry did nothing until a full page reload |
| R3 | Make `apiTypes.ts` self-contained and copy it to the client instead of compiling declarations | ✅ Selected | The compiler would write several files, not the one the client imports | The browser/server type check would have watched files nobody uses |
| R4 | Allow exactly two proven fixture changes in Phase 2 (`color`→`palette`, prefix→`groupServiceId`) | ✅ Selected | The plan's own "no value may change" rule contradicted Phase 2 | The migration would either stall or keep the old color coupling |
| R5 | Pause Drift Sync via the `DRIFT_SYNC_ENABLED` variable and drain its open PRs | ✅ Selected | Scheduled workflows only read the default-branch file; the variable is the real switch | The nightly bot could keep editing the old files mid-move |
| R6 | Print the data version at build and compare it to production after deploy | ✅ Selected | One preview cache hit cannot prove a new deploy serves new data | A release could keep showing an old map while every check passed |
| R7 | Stop and ask when the response exceeds its 100 KB size target | ✅ Selected | Every other target already had a stop rule | Whoever did the work would have had to decide alone |
| D1 | Keep the server parity test after the migration; docs explain updating its fixture on a deliberate data change | ✅ Selected | Conservative choice at stage 10 | Not recorded |
| D2 | Document, not fix, that server tests fail after `npm run fresh` | ✅ Selected | Conservative choice at stage 10; decision left to the owner | Not recorded |
| D3 | Dev-only live polling of `/api/cosmos` with `cache: 'no-store'` | ✅ Selected | The route's 60s browser cache would otherwise hide edits | A data edit would not reach the open map while developing |
