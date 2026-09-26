# Stage 8 report — Demo runner hook and `demo=ai` wiring in App

## Files
client/src/demo/useDemoRunner.ts
client/src/demo/__tests__/useDemoRunner.test.ts
client/src/demo/useDemoView.ts
client/src/demo/__tests__/useDemoView.test.ts
client/src/App.tsx

## Summary
Opening the site with `?demo=ai` now skips the intro and plays the AI demo on its own: it picks the Shopping domain, types the question into the Ask box one character at a time, opens the Connect window, picks Claude, pastes the fake Claude and JEV keys, shows it connecting and connected (without any network call), closes it, presses Search, and plays the fixed answer with its service highlights. `?speed=` speeds all of it up, including the typing.

Any real click or key press stops the demo at once. The Connect window closes, the Ask box goes back to normal, the fake connection is dropped, and the real AI status check runs again. `<html data-demo-state>` reads `running`, then `done` or `aborted`. A demo visit never writes `cosmos-intro-seen`. `?demo=all` has no script yet, so the app loads as normal but still shows the intro, as §2 requires. Without `?demo=`, the app behaves as before: same intro rule, and the real status check starts only once the intro is gone, exactly as when it lived in the shell.

`useDemoRunner` owns the AbortController, the trusted-input listener, and `data-demo-state`. It exposes `status`, `isActive`, `caption`, `target` (each kept until a later step replaces it), and `isOverlayVisible`. `useDemoView` holds what the demo shows: the typed question, the pressed Search button, the Connect window fields, and the end-card request.

Checks: `npm run typecheck` clean; `npm run lint` 0 errors (1 pre-existing warning in `client/src/map/Map.tsx`, untouched); client tests 108/108 pass (14 files, 15 new tests); `npm run build` succeeds. **Not looked at in a browser** (mobile or desktop). The full `?demo=ai` run and abort-then-use-the-app have only been checked by reading the code and by the hook-level tests.

## Commit message
feat(demo): run the AI demo from ?demo=ai and stop it on any input

The demo must drive the real app through callbacks only, and must stop as
one unit when the viewer touches anything. The fake AI connection swaps in
while it runs, so the scripted run never reaches the server.

## Key decisions
- **Ask state and both AI hooks moved from `ProjectCosmosShell` up into `App`**, because the runner (in App) must call `ask` and `setAiStatus`. It also has to span the intro for stage 12's `pressIntro`, and the shell only mounts after the intro. `realAi = useAiConnection({ enabled: !isDemoActive && !showIntro && !warping })` keeps the no-demo status check at the same moment as before. The shell now receives `aiConnection`, the ask state, `onAsk`/`onAnswerStart`/`onAskAction`, `demoAsk`, and `demoConnect` as props. Its now-unused `onPlayScenario` prop was removed.
- **Answer panel during the demo:** the `ask` step opens the panel with a module constant, `DEMO_AWAITING_ANSWER` (empty text, 60s thinking). Without it the panel would mount with `isAiConnected` true (the fake connection) and start a live `/api/ai/ask` fetch before `playAnswer` arrives. `playAnswer` then swaps in `DEMO_SCRIPTED_ANSWER` on the same panel (same nonce), and the identity-keyed effect restarts it. If the demo stops while the panel is still waiting, the teardown closes the panel. A finished answer stays open after the demo ends.
- `useDemoRunner` reads the latest `actions`/`onEnd` through refs (a small forwarding Proxy), so App's per-render actions object never restarts the run. `onEnd` does not fire on unmount. In dev StrictMode, the first run is aborted by its cleanup and a new run starts, so step 0's actions fire twice. That is harmless for `ai` (step 0 is `wait`). **Stage 12:** keep `all`'s step 0 idempotent (`pressIntro` → `setWarping(true)` is).
- Typing is App-side (`useDemoView.typeQuestion`): the question starts at `''` and gains one character every `55ms / speed`. Its interval is cleared by `reset()` on end or abort.
- **Stage-12 DemoActions**, all required by `DemoActions`. Wired now because each was trivial: `pressIntro` → the intro's own `handleIntroStart` (writes storage only outside demo mode), `playScenario` → `handlePlayScenario`, `stepBack`/`stepForward` → `navPrev`/`navNext`, `openIncident` → `handlePickScenario` (the same handler `IncidentBar` uses). `toggleLegend` is a no-op, because the legend state lives inside `Map`. **Stage 12** must wire it and check the other four against the `all` script.
- **Stage 9:** read `demoRunner.caption`, `demoRunner.target`, and `demoRunner.isOverlayVisible` in `App` (the `demoRunner` const), and use `demoSpeed` for animation scaling. `closeConnect` has no target, so `target` keeps the previous value.
- **Stage 10:** the runner never touches `data-demo-target`. Only the pointer (stage 9) will need it.
- **Stage 11:** `demoView.view.isEndCardRequested` goes true on the `endCard` step and survives the end-of-run `reset()`. Open `OVERLAY.demoEndCard` from it (e.g. an effect in App). Note that the teardown currently calls `overlay.close(OVERLAY.connect)` and may close `OVERLAY.ask`. Neither touches an end-card overlay.
- `DemoAskState` (App-local) gives `demoExpanded: true` whenever a demo question exists (from the first `type` step through `ask`). The Connect `demo` prop is passed only while `isDemoActive`, with `showJevField: true` and `isBusy: demoAi.isConnecting`.

## Open questions
None.
