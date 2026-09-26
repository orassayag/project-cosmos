# Stage 1 — Work brief

Plan: docs/plans/demo-plan.md · Branch: feature/add-ai · Report: .claude/status/stage-1-report.md

## Stage scope (from stage plan)
§1/§2: `client/src/demo/types.ts` (step union, DemoTarget, DemoActions), `client/src/demo/demoMode.ts` (readDemoMode, speed clamp, shouldShowIntro) + `client/src/demo/__tests__/demoMode.test.ts`.

Out of scope for this stage (later stages): runDemo.ts/runDemo.test (stage 2), useAiConnection/useDemoAiConnection (3), component props (4–6), scripts/scriptedAnswer (7), useDemoRunner + App.tsx wiring (8), pointer/caption/end card (9–11), demo=all (12), recorder (13). Do NOT touch App.tsx or any component in this stage.

Notes for this stage:
- `types.ts` must define the full step-kind union now (including the §7 kinds), the `DemoTarget` union covering every A1 target (Connect button, provider buttons, key fields incl. JEV, Connect submit, Search, domain buttons, play/step controls, legend toggle, intro button), and the `DemoActions` callback interface covering the §1 and §7 actions — later stages build on these types. Use the project's real ids/types (e.g. domain ids, AI provider type, AskAction) by importing them rather than redefining.
- `shouldShowIntro(demoMode, storage)` must match the intro rule App.tsx uses today (read how App decides `showIntro` / `cosmos-intro-seen`) for the `null` case, and must never write storage.

## Plan text (verbatim)

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
