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
<!-- plan: docs/plans/server-owned-data-decisions.md -->
<!-- plan: docs/plans/server-owned-data.md -->
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

## Unfork from the original project — 2026-09-30
<!-- plan: docs/plans/unfork-project.md -->
<!-- plan: docs/plans/unfork-project-additions.md -->
**Plan:** `docs/plans/unfork-project.md` · **Landed via:** /publish · **Version:** v2.7.6

**Why this feature:** The project was a GitHub fork of an MIT-licensed original and is now presented as the maintainer's own work, while keeping honest credit to the original. MIT only requires the original copyright and licence text to stay.

| # | Decision | Status | Why | Pain point behind it |
|---|----------|--------|-----|----------------------|
| R1 | Add a second copyright line for the maintainer and set the package author | ✅ Selected | The original notice stays, the new owner is named | The licence named only the original owner |
| R2 | A warn-only reminder hook for README / GitHub description upkeep that never edits GitHub | ✅ Selected | A hook cannot judge what a "major feature" is | A hook was expected to decide on its own |
| R3 | Detach on GitHub first, then confirm the repo no longer reports as a fork | ✅ Selected | One clear, checkable method | No detach method was chosen |
| R4 | Replace "fork" wording with an "Origin & credits" section | ✅ Selected | The fork wording becomes false once detached | Docs would claim a fork that no longer exists |
| R5 | Set the plugin files' owner and author to the maintainer | ✅ Selected | Not recorded | Plugin files still named the original author |
| R6 | Give the docs-vs-code audit a checklist and green checks as its finish line | ✅ Selected | Not recorded | The audit had no end point |
| A1 | Check the licences of bundled fonts, icons and images | ❌ Not selected | Offered as an optional addition, not scheduled | MIT does not cover assets with their own terms |

## Single source of truth for map data — 2026-09-30
<!-- plan: docs/plans/single-source-data.plan.md -->
**Plan:** `docs/plans/single-source-data.plan.md` · **Landed via:** /publish · **Version:** v2.7.6

**Why this feature:** The map data lived in the web app and was copied into a committed snapshot for the server, so the two could drift apart. The data moved into one shared package that the app, the server and drift-sync all import, and stayed as typed files so every edit remains a reviewable PR (a database was rejected). This package was later replaced by the server-owned data migration.

| # | Decision | Status | Why | Pain point behind it |
|---|----------|--------|-----|----------------------|
| R1 | The package points to source code in development and to built files everywhere else, with a check per consumer | ✅ Selected | Not recorded | It was only proven to work in Vite, not in the server, Vercel or drift-sync |
| R2 | Lock drift-sync's file writer to its allowed paths, reject symlinks, and ship it first in its own commit | ✅ Selected | A security fix that should not wait for the move | The nightly agent could write anywhere in the repo |
| R3 | A parity test proves the new in-memory map equals the old committed file before that file is deleted | ✅ Selected | Not recorded | A type-only check would stay green even if the content changed |
| R4 | Schemas run only in validation and tests; the app imports types only, with exact values and compile checks | ✅ Selected | Not recorded | It was unclear where validation runs, and inferred types could be looser |
| R5 | A search-driven checklist of every hard-coded old path before the move | ✅ Selected | Not recorded | The update list missed old paths in scripts, docs and skills |
| R6 | Change drift-sync's allowed paths in the same commit as the move and pause it until one manual run passes | ✅ Selected | Not recorded | The nightly agent's allowed paths would be stale between steps |
| R7 | State incidents as in scope and pin the base branch at the top of the plan | ✅ Selected | The open questions were already answerable | The plan had open questions and no base branch |

## Demo mode — 2026-09-26
<!-- plan: docs/plans/demo-plan.md -->
<!-- plan: docs/plans/demo-plan-additions.md -->
**Plan:** `docs/plans/demo-plan.md` · **Landed via:** /publish · **Version:** v2.7.6

**Why this feature:** The project supports job interviews, LinkedIn reach and the developer community, so it needed a self-playing demo that is easy to record. `?demo=ai` (under 1 minute) and `?demo=all` (under 2 minutes) play a scripted run that looks like a person using the app, without calling the AI server or using real keys.

| # | Decision | Status | Why | Pain point behind it |
|---|----------|--------|-----|----------------------|
| R1 | In demo mode only, the Connect window shows a second field for the gateway key, and the demo pastes masked fakes | ✅ Selected | The developer clarified which key the "JEV token" is | The Connect window had no place for that key |
| R2 | Write the full tour as a timed table (111 seconds) | ✅ Selected | Not recorded | `?demo=all` had no script, so it could not be built or checked |
| R3 | Play a fixed, correct AstroMart answer with fixed thinking time and typing pace | ✅ Selected | Not recorded | The existing answer was a joke saying there is no AI |
| R4 | The demo controls the question text and the expanded state of the ask box | ✅ Selected | Not recorded | Going back to the question erased it |
| R5 | A local fake connection replaces the real one; no AI server calls during a demo | ✅ Selected | Not recorded | The demo could break, or spend a real key, when the AI was already connected |
| R6 | `demo=ai` skips the intro, `demo=all` clicks through it, and neither marks it as seen | ✅ Selected | Not recorded | First-time visitors saw the intro screen instead of the map |
| R7 | A typed step list run by one cancellable runner that calls app callbacks | ✅ Selected | Not recorded (later replaced: tours now drive the real UI with real events) | The plan did not say how the automation drives the app |
| R8 | A real click or key press stops the demo at once | ✅ Selected | Not recorded | Nothing defined what happens if a viewer touches the page mid-demo |
| R9 | A unit test sums each script's time, and the recorder checks real time | ✅ Selected | Not recorded | Nothing checked the 1-minute / 2-minute limits |
| R10 | Record on desktop, but it must still work at 390px with one panel at a time | ✅ Selected | Mobile-first rule | No target screen size was set |
| A1 | Visible fake mouse pointer | ✅ Selected | Accepted at finalize | Automated clicks are invisible on video |
| A2 | End card with contact links | ✅ Selected | Accepted at finalize | The video had no call to action |
| A3 | Caption bar for silent autoplay | ✅ Selected | Accepted at finalize | LinkedIn videos autoplay muted |
| A4 | One-command re-recording | ✅ Selected | Accepted at finalize | Re-recording after UI changes was manual |
| A5 | Speed dial for rehearsals (`&speed=4`) | ✅ Selected | Accepted at finalize | Checking the tour took 2 minutes each time |

## Real AI agent — 2026-09-26
<!-- plan: docs/plans/add-ai.md -->
<!-- plan: docs/plans/add-ai-additions.md -->
**Plan:** `docs/plans/add-ai.md` · **Landed via:** /publish · **Version:** v2.7.6

**Why this feature:** The "Explore Project Cosmos" box showed canned joke answers. It was replaced by a real AI agent that answers from the map and can light up services or play scenarios, with a cheap classifier that turns away off-topic questions first. This needed a server, so the repo was split into `client/` and `server/` on one Vercel project. (The visitor-key design was later replaced by the keyless chat.)

| # | Decision | Status | Why | Pain point behind it |
|---|----------|--------|-----|----------------------|
| R1 | JEV is a classification model on Vercel AI Gateway, on the owner's gateway key | ✅ Selected | Not recorded | "JEV" was not a known tool |
| R2 | Do the full `client/` + `server/` split and fix every consumer | ✅ Selected | Developer's choice | Moving everything into `client/` broke the rest of the repo |
| R3 | Vercel is the single live site; GitHub Pages only redirects | ✅ Selected | Not recorded | One of the two live sites could not run a server |
| R4 | Store the visitor's key in an encrypted, script-proof cookie; never log secrets | ✅ Selected | Not recorded | Visitors' API keys needed a safe storage design |
| R5 | Define the agent's knowledge, prompt, map tools and graph | ✅ Selected | Not recorded | The agent's job was never defined |
| R6 | Classify on the owner's key with a free keyword fallback, never the visitor's model | ✅ Selected | Not recorded | Off-topic questions would cost visitors money when JEV was not set up |
| R7 | An API-key window, one provider at a time | ✅ Selected | Not recorded | "Authenticate" really meant "paste an API key" |
| R8 | The window is built mobile-first with its own close button and one-card-at-a-time | ✅ Selected | Mobile rules | The new window had to follow the mobile rules |
| R9 | Check the key on connect and on every page load; a 401 disconnects | ✅ Selected | Not recorded | The green light could lie |
| R10 | Map provider errors three ways on the server | ✅ Selected | Not recorded | "No tokens left" covered several different errors |
| R11 | Vitest in both workspaces, run in CI | ✅ Selected | Not recorded | Tests had nowhere to run |
| R12 | `.js` on every relative server import, enforced by the compiler | ✅ Selected | Known Vercel lesson | Server imports without `.js` break on Vercel |
| R13 | Round 2: a missing gateway key falls back to the keyword check instead of crashing | ✅ Selected | Not recorded | The server crashed without the gateway key |
| R14 | Round 2: the map accepts several highlighted services | ✅ Selected | Not recorded | The map could light up only one star |
| R15 | Round 2: the root `validate` stays the map checker; only build/lint/typecheck/test fan out | ✅ Selected | Not recorded | Per-workspace validate could quietly skip the map checker |
| R16 | Round 2: the client disconnects when the stream reports an invalid key | ✅ Selected | Not recorded | A dead key found mid-answer could not log out in that response |
| R17 | Round 2: the connect window joins the app's panel manager | ✅ Selected | Not recorded | The CSS rule alone did not keep panels from stacking |
| A1 | Let the agent replay past incidents | ❌ Not selected | Offered as an optional addition, not scheduled | The agent could talk about incidents but not play them |

## Replay a production incident — 2026-09-19
<!-- plan: docs/plans/plan.md -->
**Plan:** `docs/plans/plan.md` · **Landed via:** /publish · **Version:** v2.7.6

**Why this feature:** Recorded production incidents can be replayed on the map as frozen scenarios, so a team can walk through what happened hop by hop without any AI. The plan has no Issue Resolutions table, so no review decisions are recorded.
