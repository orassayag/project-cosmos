# Demo Mode — Plan

## Summary

Project Cosmos exists to support job interviews, grow LinkedIn reach, and help the developer
community. A self-playing demo makes the project easy to show in a short, recordable video.
Adding `?demo=ai` or `?demo=all` to the URL starts a scripted run that looks like a person
using the app. `demo=ai` types a question, connects an AI agent by pasting the Claude key and
the JEV (Vercel AI Gateway) key, and plays a fixed, correct answer. It finishes within 1 minute.
`demo=all` tours the main features in a fixed order and finishes within 2 minutes.

The demo is pure theatre on the client. It never calls the AI server, never uses a real key,
and looks the same in every browser. A real click or key press stops it at once and gives the
app back to the viewer.

## Scope

**In scope**
- `?demo=ai` and `?demo=all`, driven by one typed script runner in `client/src/demo/`.
- A fake AI connection for demo mode, a scripted answer, and demo-only display props on
  `AskAgent`, `AskPanel`, and `ConnectAgentModal`.
- A demo-only JEV key field in the Connect window, so the video shows both keys being pasted.
- Skipping or pressing the intro, aborting on real input, and a unit test for each time limit.
- Accepted additions A1–A5: a visible fake pointer, an end card with contact links, a caption
  bar, a one-command Playwright recorder, and a `?speed=` dial for rehearsals.

**Out of scope**
- Any server change. The demo never calls `/api/ai/status`, `/api/ai/connect`, or `/api/ai/ask`.
- Changing what normal visitors see. Without `?demo=`, every component behaves as it does today.
- Recording or publishing the video. A4 produces the file, and uploading it is manual.
- Honoring reduced-motion settings, and rate-limiting `?demo=`. Both were dropped by the scope
  gate: the demo is opt-in and never reaches the server.

### Scope Yardstick

| Dimension | Value | Evidence |
|---|---|---|
| Kind | Demo / portfolio | Plan goals (job interviews, LinkedIn, community); `CLAUDE.md` "Demo data is fictional (AstroMart)" |
| Audience & traffic | The developer recording a video; occasional visitors who open a `?demo=` link | Plan: "needs to be recorded as a video" |
| Surfaces | Browser client only for this feature. The app does have a server with `/api/ai/*` and an httpOnly key cookie — the demo must stay off it | `client/src/hooks/useAiConnection.ts`; plan says "simulate" every step |
| Lifetime | Maintained by one person, re-recorded as the app changes | ASSUMED |
| Team | Solo | git history, single author |
| Constraints | `?demo=ai` ≤ 1 min, `?demo=all` ≤ 2 min; mobile-first and one-panel-at-a-time invariants apply to every feature | Plan; `CLAUDE.md` "Responsive / mobile" |

## Issue Resolutions

| ID | Title | Detected by | Resolution | Notes |
|----|-------|------------|------------|-------|
| I1 | The Connect window has no place for a "Vercel JEV token" | Claude | Fixed | Developer: the JEV key is the site owner's AI Gateway key from `docs/plans/add-ai.md` §5 (`AI_GATEWAY_API_KEY`). In demo mode only, the Connect window shows a second field for it, and the demo pastes a masked fake into each field. Design §4. |
| I2 | `?demo=all` has no script, so it can't be built or checked | Claude | Fixed | The tour is a timed table that adds up to 111s. Design §7. |
| I3 | The "answer like today" is the joke answer that says there's no AI | Claude | Fixed | A fixed AstroMart answer through a new `scriptedAnswer` prop, with fixed thinking time and word pace. Design §5. |
| I4 | Going back to the question erases it | Claude (adversarial) | Fixed | `AskAgent` demo props control the text and the expanded state; the demo calls `onAsk` directly. Design §5. |
| I5 | The demo breaks, or spends a real key, when the real AI status isn't "disconnected" | Claude (adversarial) | Fixed | A local fake connection replaces the real one, and the real hook is disabled. No `/api/ai/*` calls. Design §3. |
| I6 | First-time visitors hit the intro screen, and the map isn't there yet | Claude (adversarial) | Fixed | `demo=ai` skips the intro. `demo=all` presses it as step 0. `cosmos-intro-seen` is never written. Design §2. |
| I7 | The plan doesn't say *how* the automation drives the app | Claude | Fixed | A typed step list plus one runner with one `AbortController` that calls app callbacks, not DOM events. Design §1. |
| I8 | Nothing defined for a viewer who touches the page mid-demo | Claude | Fixed | A trusted `pointerdown`/`keydown` aborts the run. Design §1. |
| I9 | Nothing checks the 1-minute / 2-minute limits | Claude | Fixed | A unit test sums each script, and the A4 recorder checks real time. Design §9. |
| I10 | No target screen size, despite the mobile-first rule | Claude | Fixed | Recorded on desktop. It must still work at 390px, with one panel at a time. Design §10. |

## Design

Both demos are delivered together in one change (the developer's decision). The draft's scope
challenge proposed shipping `demo=ai` first, so the build order still goes §1–§6, §8, §9 before
§7, but nothing is released between them.

### §1 — Runner (`client/src/demo/`)

- `demoMode.ts` has `readDemoMode(url): { mode: 'ai' | 'all'; speed: number } | null`.
  Values other than `ai` or `all` return `null`, so the app loads as normal (I7).
  `speed` comes from `?speed=`, is clamped to 1–8, and defaults to 1 (A5).
- `types.ts` defines a typed step union. Every step has `durationMs` and an optional `caption`
  (A3):
  `{ kind: 'pressIntro' | 'pickDomain' | 'type' | 'openConnect' | 'pickProvider' | 'paste' |
  'connect' | 'closeConnect' | 'ask' | 'answer' | 'playScenario' | 'stepBack' | 'stepForward' |
  'openIncident' | 'toggleLegend' | 'wait' | 'endCard'; target?: DemoTarget; … }`.
  `target` names a `data-demo-target` attribute that the pointer moves to (A1).
- `runDemo.ts` has `runDemo(script, actions: DemoActions, { signal, speed })`. It runs the steps
  one after another and awaits `sleep(durationMs / speed, signal)`. It changes the app only by
  calling `DemoActions`, which are callbacks App supplies (`pickDomain`, `setQuestion`,
  `openConnect`, `setConnectField`, `setAiStatus`, `ask`, `playScenario`, …). It never
  dispatches DOM events. The app's buttons act on mouse-down, and the map's pan handler cancels
  background presses, so synthetic clicks would do nothing (I7).
- Abort (I8): `useDemoRunner` owns one `AbortController`. A `pointerdown` or `keydown` on
  `window` with `event.isTrusted` aborts it. On abort or on finish it hides the pointer and
  caption, drops the fake AI connection back to the real one (§3), and sets
  `<html data-demo-state="aborted" | "done">`, which A4 waits for. Timers are cleared through
  the signal, so none keep running.
- Tests: `client/src/demo/__tests__/demoMode.test.ts` covers `ai`, `all`, an unknown value
  (returns null), and speed clamping (`0`→1, `20`→8, `abc`→1). *Protects: a bad URL can never
  start a half-configured demo.* `client/src/demo/__tests__/runDemo.test.ts` uses vitest fake
  timers. Actions are called in script order. `speed: 4` finishes in a quarter of the time. An
  abort mid-run means no later action is called and no timer is pending. A trusted `pointerdown`
  aborts the run. *Protects: I7/I8. The run is deterministic and stoppable as one unit.* Unit
  layer.

### §2 — Entering demo mode and the intro (I6)

In `App.tsx`, read `readDemoMode(window.location.href)` once at mount. Then:
- `demo=ai` initializes `showIntro` to `false`.
- `demo=all` keeps the intro, and its step 0 (`pressIntro`) calls the same handler the intro
  button uses. The warp is counted in the time budget (4s).
- In demo mode, `cosmos-intro-seen` is **never** written, so a later normal visit still gets the
  intro. Put the rule in a small pure helper, `shouldShowIntro(demoMode, storage)`, in
  `demoMode.ts`.
- Test: `demoMode.test.ts` adds that `ai` returns false, `all` returns true in a fresh browser,
  and `null` behaves as today. Storage is never written. *Protects: a fresh recording browser
  starts on the map.* Unit layer.

### §3 — Fake AI connection (I5)

- `useAiConnection({ enabled })` gets an `enabled` option, true by default. When it is false,
  the hook skips the `/api/ai/status` fetch and reports `disconnected`.
- `useDemoAiConnection()` in `client/src/demo/` returns the same `AiConnection` shape. Its
  status is driven by the runner (`disconnected → connecting → connected`) and its provider is
  `anthropic`. Its `connect`/`disconnect` never touch the network.
- App calls both hooks unconditionally, following the rules of hooks, and passes
  `demo ? demoAi : realAi` down. While the demo is active, `realAi` is created with
  `enabled: false`. After an abort, App switches back to `realAi`, which then re-checks status.
- Tests: `client/src/hooks/__tests__/useAiConnection.test.ts` adds that `enabled: false` makes
  no `fetch` call. *Protects: the demo never calls the AI server, for any visitor state.* The
  runner test asserts that `fetch` is never called during a full `ai` script. Unit layer.

### §4 — Connect window with the JEV key (I1)

Per the developer, the JEV key is real. It is the site owner's Vercel AI Gateway key
(`AI_GATEWAY_API_KEY`), which JEV classification uses (`docs/plans/add-ai.md` §5). The video
shows both keys being pasted.

- `ConnectAgentModal` gets an optional `demo?: DemoConnectState` prop:
  `{ provider, providerKey, jevKey, showJevField, isBusy }`. When the prop is present:
  - The dialog is controlled by it: provider, the key value, and the busy state.
  - Below the provider key it renders a second `lc-connect-field` labelled **"Vercel AI Gateway
    key (JEV, site owner)"**, with the same password input style.
  - Submitting calls **no** `onConnect`. The runner drives `connecting → connected` through §3.
- When the prop is absent, the dialog behaves exactly as today. Visitors never see a JEV field,
  and in production the key stays a server environment variable.
- The pasted values are obvious fakes (`sk-ant-demo-••••••••`, `vck-demo-••••••••`). They
  appear all at once, like a paste, not one letter at a time.
- A caption on the paste step reads "Adding the JEV key (the site's question classifier)", so
  the video is honest about the key's role.
- Accepted gap: the video shows a field that real visitors don't have. The developer accepted
  this; the "site owner" label and the caption make the key's role clear.
- Tests: `client/src/components/__tests__/ConnectAgentModal.test.tsx` adds two cases. With
  `demo`, the JEV field (labelled "site owner") and both masked values render, and submitting never calls `onConnect`.
  Without `demo`, there is no JEV field. *Protects: the demo field never leaks to real visitors,
  and the demo never submits a key.* Component layer.

### §5 — Question and scripted answer (I3, I4)

- `AskAgent` gets optional `demoQuestion?: string`, `demoExpanded?: boolean`, and
  `demoSearchPressed?: boolean`. When `demoQuestion` is defined, it is the text shown and the
  focus-clears-text path is bypassed. The `type` step grows the text one character per 55ms, so
  it looks like a person typing. The `ask` step shows the Search button pressed for 250ms, then
  the runner calls `onAsk(question)` directly.
- Demo question: *"Which services does placing an order go through, and who owns them?"*
  (69 characters, about 3.8s to type).
- `AskPanel` gets an optional `scriptedAnswer?: { text: string; thinkingMs: number; wordMs:
  number; actions?: AskAction[] }`. When it is set, the panel plays that text with fixed timing
  (thinking 1500ms, 90ms per word) and fires `actions` when the answer starts. The joke list and
  the connect prompt are skipped, and no request is made. The joke list is untouched for normal
  visitors.
- The answer is about 70 words of fictional AstroMart facts, taken from the
  `shopping.place-order` steps and `owners.ts`. It lives in `client/src/demo/scriptedAnswer.ts`,
  with a `highlight` action for the services it names.
- Tests:
  - `AskAgent.test.tsx`: `demoQuestion` renders, focusing the box does not clear it, and the
    Search pressed state shows. *Protects: I4.*
  - `AskPanel.test.tsx`: `scriptedAnswer` renders the exact text after `thinkingMs +
    words × wordMs` with fake timers, `fetch` is never called, and `onAction` gets the highlight.
    *Protects: I3/I5. The same answer every time, with no joke.*
  - `client/src/demo/__tests__/scriptedAnswer.test.ts`: every highlighted id exists in
    `SERVICES`. *Protects: the answer stays true to the map when services change.*
  - All at the component/unit layer.

### §6 — `demo=ai` script (≤ 60s)

| # | Step | ms | Caption |
|---|------|----|---------|
| 0 | wait (settle) | 800 | — |
| 1 | pickDomain `shopping` | 1200 | "Exploring the Shopping domain" |
| 2 | type question | 4000 | "Asking the map a question" |
| 3 | wait | 600 | — |
| 4 | openConnect (pointer → Connect) | 1100 | "Connecting an AI agent" |
| 5 | pickProvider Claude | 600 | — |
| 6 | paste Claude key | 900 | "Pasting a Claude key" |
| 7 | paste JEV key | 900 | "Adding the JEV key (the site's question classifier)" |
| 8 | connect (busy → connected) | 2500 | "Connecting…" |
| 9 | closeConnect | 400 | — |
| 10 | ask (Search pressed) | 800 | — |
| 11 | answer (thinking + words) | 8500 | "The agent answers from the live map" |
| 12 | wait (hold on highlight) | 3000 | — |
| 13 | endCard | 4000 | — |
| | **Total** | **29,300** | |

That leaves about 30s of headroom under the 60s limit for re-timing after watching a recording.
Each step that clicks something has a `target`, so the A1 pointer glides there first (inside the
step's time).

### §7 — `demo=all` script (≤ 120s) (I2)

| # | Segment | ms |
|---|---------|----|
| 0 | pressIntro + warp | 4,000 |
| 1 | Domain switch: Shopping → Fulfillment → Shopping | 8,000 |
| 2 | Play "Place an order" (`shopping.place-order`) | 30,000 |
| 3 | Step back ×2, forward ×2 | 10,000 |
| 4 | Open a recorded incident (the first in `INCIDENTS`) and let it play | 20,000 |
| 5 | Ownership legend on, hold, off | 10,000 |
| 6 | `demo=ai` sequence, shortened (skip steps 0, 1, 12; answer 7,000) | 25,000 |
| 7 | endCard | 4,000 |
| | **Total** | **111,000** |

- New `DemoActions`: `pressIntro`, `playScenario`, `stepBack`, `stepForward`, `openIncident`,
  `toggleLegend`. Each one is wired to the handler App already uses (`handlePlayScenario`,
  `navPlay`, the overlay manager for `OVERLAY.mapOwnership`).
- The `wait` for segments 2 and 4 must cover the real playback length of that scenario or
  incident. Segment 2 sums the step durations from the scenario data, and the script builder
  reads them from there, so a data change updates the budget automatically.
- Test: `scripts.test.ts` (§9). Segment 2's time comes from the scenario data, not a constant.
  *Protects: I2. The tour is fixed and stays within its limit.*

### §8 — Accepted additions

- **A1 — Fake pointer.** `DemoPointer.tsx` is one absolutely positioned SVG arrow in a portal.
  Before each targeted step, it moves over 500ms to the center of
  `document.querySelector('[data-demo-target="…"]').getBoundingClientRect()`, then shows a 300ms
  ripple. Add `data-demo-target` to: the Connect button, the provider buttons, the key fields,
  the Connect submit, Search, domain buttons, play/step controls, the legend toggle, and the
  intro button. The pointer is hidden on phones (touch has no cursor) and has
  `pointer-events: none`. Verify: visual, in the A4 recording.
- **A2 — End card.** `DemoEndCard.tsx` reads "Built by Or Assayag · GitHub · LinkedIn". The
  GitHub link points to the repo, using the URL from `package.json` `repository`. The LinkedIn link is
  `https://www.linkedin.com/in/orassayag/`. The card joins the overlay
  manager as `OVERLAY.demoEndCard` and has a top-right close button (mobile close-button
  contract). It stays open after the run finishes. Test: `DemoEndCard.test.tsx` renders both
  links with `rel="noopener noreferrer"`, and close calls the overlay close.
- **A3 — Captions.** `DemoCaption.tsx` is a one-line bar at the bottom center with
  `aria-live="polite"`. It shows the current step's `caption` and keeps the last one until a new
  caption replaces it. It is a caption strip, not a panel. On phones it sits above the playback
  controls and is hidden while a detail card is open, following the "one card at a time" block
  in `responsive.css`. Verify: visual at 390px and desktop.
- **A4 — Recorder.** `scripts/record-demo.mjs` (`npm run record:demo -- ai|all`), with
  `playwright` as a root devDependency. It opens `${BASE_URL:-http://localhost:5173}/?demo=<mode>`
  at 1920×1080 with `recordVideo`, waits for `html[data-demo-state="done"]`, and saves the video
  to `recordings/demo-<mode>.webm` (gitignored). It **exits non-zero if the real elapsed time is
  over 60s or 120s**, which is the real-time check for §9. Verify: run it for both modes.
- **A5 — Speed dial.** `?speed=` is parsed in §1, and the runner divides every duration by it.
  The pointer and caption animations scale too. Covered by `runDemo.test.ts`.

### §9 — Time limits (I9)

`client/src/demo/__tests__/scripts.test.ts` builds both scripts and sums `durationMs`. It
asserts `ai ≤ 60_000` and `all ≤ 120_000`. It also asserts that every step `kind` has a handler
in `DemoActions`, and every `target` exists in the `DemoTarget` union. *Protects: a timing edit
cannot silently push a demo over its limit.* Unit layer. The A4 recorder is the real-time
backstop, because the scenario playback in §7 runs on the app's own clock.

### §10 — Screens (I10)

The demo is **recorded on desktop (1920×1080) and must not break on phones.** It is built and
checked at 390px first, per the mobile-first invariant:
- The Connect window and the answer panel never show at the same time. The overlay manager
  already stacks them, and closing the Connect window restores the answer panel.
- The caption hides behind detail cards (A3), and the end card has its close button (A2).
- The pointer is hidden on touch devices.

Verify manually at 390×844 portrait and 844×390 landscape with `?demo=ai&speed=4`.

### Final acceptance

- `/test`: `npm run typecheck`, `npm run lint`, `npm test` (vitest in `client/`), and
  `npm run build` all pass.
- `npm run record:demo -- ai` and `-- all` both finish under their limits and produce videos
  that match the §6 and §7 tables.
- Opening the site without `?demo=` behaves as it does today: the intro, a real AI status
  check, and the joke answer when disconnected.
- Clicking anywhere mid-demo stops it, and the app is fully usable afterwards.
