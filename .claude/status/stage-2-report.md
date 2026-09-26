# Stage 2 report

## Files
client/src/demo/runDemo.ts
client/src/demo/__tests__/runDemo.test.ts

## Summary
Added the demo runner. `runDemo(script, actions, { signal, speed, onStepStart? })` plays steps one after another, changes the app only through `DemoActions`, divides every duration by `speed`, and resolves `'done'` or `'aborted'` (it never throws on abort). `sleep(ms, signal)` clears its timer on abort and removes its abort listener when it resolves. `scaledDuration(ms, speed)` is exported so stage 9's pointer and caption animations can scale. `abortOnTrustedInput(controller, target = window)` aborts on a trusted `pointerdown`/`keydown`, ignores untrusted events, and returns a cleanup function for stage 8's hook to reuse. `types.ts` is unchanged.
The tests (18, fake timers) cover: script order; every `DEMO_STEP_KINDS` entry calling exactly the callbacks in `DEMO_STEP_ACTIONS`; `connect` and `ask` timing within a step; speed 4 finishing in a quarter of the time; abort mid-run (no later action, `vi.getTimerCount() === 0`); an already-aborted signal calling nothing; a non-positive speed being rejected; and trusted vs. untrusted input, including a trusted `pointerdown` stopping a running demo.
Verification: `npm run typecheck` is clean. `npm run lint` has 0 errors and 1 warning that was already there, in `Map.tsx`, which this stage did not touch. `npm --prefix client test` passes 9 files / 67 tests.

## Commit message
feat(demo): add abortable demo runner with speed scaling

The demo must drive the app only through App-supplied callbacks, since
synthetic clicks are ignored by mouse-down buttons and the map pan handler.
One AbortSignal stops the whole run with no stray timers, and only real
viewer input can trigger it.

## Key decisions
- **Call-then-sleep.** A step's actions fire at its start, then its `durationMs` elapses, so the step's result stays on screen for its whole duration. Two steps split their duration instead of adding to it. `connect` calls `setAiStatus('connecting')`, waits `durationMs`, then calls `setAiStatus('connected')`. `ask` calls `setSearchPressed(true)`, waits `min(SEARCH_PRESS_MS=150, durationMs)`, calls `setSearchPressed(false)` and then `ask(question)`, and waits for the rest of the duration. Both steps take exactly `durationMs / speed` in total.
- **Added `onStepStart?(step, stepIndex)` to the run options.** It fires before each step's actions. Stage 9 needs a way to follow the script to move the pointer to `step.target` and show `step.caption`, and `DemoActions` has no pointer or caption callbacks. It is optional, and the runner itself ignores `target`/`caption`.
- **Abort during a step.** If an abort lands while the search button is pressed or while the fake connection is `connecting`, no more actions run. That means `setSearchPressed(false)` / `setAiStatus('connected')` never fire. Stage 8's teardown must reset the pressed state and drop the fake AI connection. The plan already gives it that job (§1 I8).
- **Speed validation.** `runDemo` throws a `RangeError` for a speed that is not finite or not positive. `readDemoMode` already clamps speed to 1–8, so this only catches a wiring bug.
- **Test for trusted input.** jsdom's `Event.isTrusted` is a non-configurable getter, so `Object.defineProperty` throws (I checked this directly). The workaround in the brief does not work. Instead, `abortOnTrustedInput` takes `target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>`. The tests pass a fake target that calls the listener with `{ isTrusted: true }`, and a real `window.dispatchEvent` (untrusted) test proves synthetic events do not abort.

## Open questions
- The global workflow asks for verified platform facts to be written to `~/.claude/bank/platform-facts/`. The fact here is that jsdom 30's `Event.isTrusted` cannot be overridden via `defineProperty`. The stage scope contract does not let me touch files outside this stage, so I did not write it. The orchestrator can record it if wanted.
