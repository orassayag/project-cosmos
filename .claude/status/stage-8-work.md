# Stage 8 work brief — §1/§2/§3: demo/useDemoRunner.ts + App.tsx wiring for `demo=ai`

## Stage scope (from docs/status/stage-plan.md)
Stage 8: §1/§2/§3: demo/useDemoRunner.ts (AbortController, trusted-input abort, data-demo-state) + App.tsx wiring for `demo=ai` (intro skip, fake/real AI swap, DemoActions)

Out of scope for this stage: DemoPointer / DemoCaption components and their CSS (stage 9), `data-demo-target` attributes (stage 10), DemoEndCard + `OVERLAY.demoEndCard` (stage 11), the `demo=all` script and its extra DemoActions — pressIntro, playScenario, stepBack/Forward, openIncident, toggleLegend — (stage 12), the recorder (stage 13).

What this stage must leave behind for later stages:
- `useDemoRunner` exposes the current step's `caption` (kept until replaced) and `target`, plus
  whether the pointer/caption should be visible (false after abort/done), so stage 9 only has to
  mount components reading that state.
- The `endCard` DemoAction exists and records "end card requested" in state (stage 11 will open
  `OVERLAY.demoEndCard` from it). Do not build any end-card UI now.
- `demo=all` must not crash: `DEMO_SCRIPTS.all` is undefined until stage 12 — treat a mode with no
  script as "no demo" (app loads normally), but still honor §2's intro rule via `shouldShowIntro`.
- Stage-12 DemoActions (pressIntro, playScenario, …): if `DemoActions` in `demo/types.ts` already
  declares them as required, supply minimal wiring to the existing App handlers only if trivial;
  otherwise leave them for stage 12 and say so in the report. Don't widen scope beyond that.

## Plan excerpts (verbatim, docs/plans/demo-plan.md)

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

### §4 — Connect window with the JEV key (I1) — the App-side part only

- `ConnectAgentModal` gets an optional `demo?: DemoConnectState` prop:
  `{ provider, providerKey, jevKey, showJevField, isBusy }`. When the prop is present:
  - The dialog is controlled by it: provider, the key value, and the busy state.
  - Submitting calls **no** `onConnect`. The runner drives `connecting → connected` through §3.
- When the prop is absent, the dialog behaves exactly as today.

### §5 — Question and scripted answer (I3, I4) — the App-side part only

- `AskAgent` gets optional `demoQuestion?: string`, `demoExpanded?: boolean`, and
  `demoSearchPressed?: boolean`. When `demoQuestion` is defined, it is the text shown and the
  focus-clears-text path is bypassed. The `type` step grows the text one character per 55ms, so
  it looks like a person typing. The `ask` step shows the Search button pressed for 250ms, then
  the runner calls `onAsk(question)` directly.
- `AskPanel` gets an optional `scriptedAnswer`. When it is set, the panel plays that text with
  fixed timing and fires `actions` when the answer starts.

### §6 — `demo=ai` script (≤ 60s)
(Already built in stage 7 as `AI_DEMO_SCRIPT` in `client/src/demo/scripts.ts` — use it, don't redefine.)

### §10 — Screens (I10)
The Connect window and the answer panel never show at the same time. The overlay manager
already stacks them, and closing the Connect window restores the answer panel.

### Final acceptance (relevant lines)
- Opening the site without `?demo=` behaves as it does today: the intro, a real AI status
  check, and the joke answer when disconnected.
- Clicking anywhere mid-demo stops it, and the app is fully usable afterwards.

## Carry-forward notes from the ledger addressed to stage 8
- Call both hooks every render: `realAi = useAiConnection({ enabled: !isDemoActive })`,
  `demoAi = useDemoAiConnection()`, pass `isDemoActive ? demoAi : realAi`;
  `DemoActions.setAiStatus = demoAi.setDemoStatus`; on end/abort call
  `demoAi.setDemoStatus('disconnected')` and clear `isDemoActive`.
- `ConnectAgentModal` `demo` prop: `provider` from `pickProvider`, `providerKey`/`jevKey` from
  `setConnectField` (both start `''`), `showJevField: true`, `isBusy: demoAi.isConnecting` — pass
  it only while the demo is active.
- `AskAgent`: pass `demoQuestion=''` (not `undefined`) at the start of a `type` step; keep
  `demoExpanded: true` through the `ask` step (Search renders only while expanded).
- `AskPanel` `scriptedAnswer`: pass `DEMO_SCRIPTED_ANSWER` itself (module constant) — the effect is
  keyed on object identity; never an inline literal.
- Look up the script via `DEMO_SCRIPTS[mode]`. `closeConnect` has no `target`.

## Tests expected this stage
- A `useDemoRunner` test (`client/src/demo/__tests__/useDemoRunner.test.ts[x]`) with fake timers:
  runs the script to the end and sets `html[data-demo-state="done"]`; a trusted `pointerdown` /
  `keydown` aborts (no later action, `data-demo-state="aborted"`, fake AI dropped back); an
  untrusted event does not abort; unmount clears timers/listeners.
- Existing suites must stay green; the no-`?demo=` path must be unchanged.
