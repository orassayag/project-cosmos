# Stage 2 work brief — §1/A5: runDemo.ts + runDemo.test

Stage-plan line: `runDemo.ts (sequential steps, abortable sleep, speed divisor) + runDemo.test (fake timers, order, speed, abort, trusted pointerdown)`

Files expected (≤6 files, ≤300 lines each):
- `client/src/demo/runDemo.ts` (new)
- `client/src/demo/__tests__/runDemo.test.ts` (new)

Builds on stage 1's `client/src/demo/types.ts` (`DemoStep`, `DemoActions`, `DEMO_STEP_ACTIONS`, etc.) — read it first; do not redefine those types. Only amend `types.ts` if runDemo genuinely needs it, and say so in the report.

## Plan — §1 Runner (verbatim)

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
- Tests: … `client/src/demo/__tests__/runDemo.test.ts` uses vitest fake
  timers. Actions are called in script order. `speed: 4` finishes in a quarter of the time. An
  abort mid-run means no later action is called and no timer is pending. A trusted `pointerdown`
  aborts the run. *Protects: I7/I8. The run is deterministic and stoppable as one unit.* Unit
  layer.

## Plan — §8 A5 Speed dial (verbatim)

- **A5 — Speed dial.** `?speed=` is parsed in §1, and the runner divides every duration by it.
  The pointer and caption animations scale too. Covered by `runDemo.test.ts`.

## Scope notes (orchestrator)

- `useDemoRunner` (the React hook, App wiring, `data-demo-state`) is **stage 8**, not this stage.
  To satisfy "a trusted `pointerdown` aborts the run" at the unit layer here, export a small
  framework-free helper from `runDemo.ts` (e.g. `abortOnTrustedInput(controller, target = window)`
  returning a cleanup function) that listens for `pointerdown`/`keydown`, aborts only when
  `event.isTrusted`, and that stage 8's hook will reuse. Test that an untrusted synthetic event
  does NOT abort and a trusted one does (jsdom events are untrusted by default — fake `isTrusted`
  in the test, e.g. by dispatching an event whose `isTrusted` is overridden via
  `Object.defineProperty`).
- Step dispatch: each step kind calls the `DemoActions` callbacks per stage 1's
  `DEMO_STEP_ACTIONS` mapping (`ask` → `setSearchPressed` + `ask`; `connect` → `setAiStatus`
  `connecting` then `connected`; `wait` → nothing; etc.). Decide call-then-sleep vs.
  sleep-then-call for the step duration and document it under Key decisions.
- `runDemo` should resolve to a result the hook can map to `done` / `aborted` (e.g. returns
  `'done' | 'aborted'`, never throws on abort). An already-aborted signal must call no action.
- The abortable `sleep(ms, signal)` must clear its `setTimeout` on abort (no pending timer —
  assert with `vi.getTimerCount()`) and remove its abort listener when it resolves.
- Speed: divide every `durationMs` by `speed`; also expose the speed so stage 9 pointer/caption
  animations can scale (e.g. export a `scaledDuration(ms, speed)` helper) — keep it minimal.
