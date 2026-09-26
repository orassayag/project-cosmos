# Stage 7 work brief — §5/§6/§9: demo/scriptedAnswer.ts + test, demo/scripts.ts (`demo=ai` table) + scripts.test

## Stage scope (from docs/status/stage-plan.md)
Stage 7: §5/§6/§9: demo/scriptedAnswer.ts + test, demo/scripts.ts (`demo=ai` table) + scripts.test (ai ≤ 60s, handler + target coverage)

Out of scope for this stage: `demo=all` script (stage 12), App wiring / useDemoRunner (stage 8), DemoPointer/Caption (9), data-demo-target attributes (10), end card (11). Only build the `demo=ai` script now; structure scripts.ts so stage 12 can add `demo=all` beside it.

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

### §9 — Time limits (I9)

`client/src/demo/__tests__/scripts.test.ts` builds both scripts and sums `durationMs`. It
asserts `ai ≤ 60_000` and `all ≤ 120_000`. It also asserts that every step `kind` has a handler
in `DemoActions`, and every `target` exists in the `DemoTarget` union. *Protects: a timing edit
cannot silently push a demo over its limit.* Unit layer. The A4 recorder is the real-time
backstop, because the scenario playback in §7 runs on the app's own clock.


## Carried over from the ledger
- Stage 3 deferred to this stage: a runner test that plays the full `demo=ai` script (fake timers, `runDemo`) and asserts `fetch` is never called.
- Use the existing `DEMO_STEP_KINDS`, `DEMO_TARGETS`, `DEMO_STEP_ACTIONS` (client/src/demo/types.ts) for the §9 coverage assertions; `DemoScriptedAnswer { text; thinkingMs; wordMs; actions? }` is the answer's type (thinking 1500ms, 90ms/word per §5; the whole answer must fit the 8500ms `answer` step).
- Service ids and owners come from client/src/scenarios/ (`services.ts`, `owners.ts`, `steps/shopping.ts` for `shopping.place-order`). Keep all facts fictional AstroMart.
