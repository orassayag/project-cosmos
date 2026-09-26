## Files
client/src/demo/scripts.ts
client/src/demo/__tests__/scripts.test.ts
client/src/demo/__tests__/demoTargets.test.tsx
client/src/App.tsx
client/src/map/Map.tsx
client/src/map/CometPackets.tsx

## Summary
`?demo=all` now plays a full tour of the site, 116.6s long. It starts on the intro, which it presses. It then switches domains (Shopping → Fulfillment → Shopping) and plays "Place an order". It steps back twice and forward twice, then replays the newest recorded incident. It turns the Ownership legend on, holds it, and turns it off. It then runs a shortened version of the AI demo and finishes on the end card.

The waits for the scenario and the incident are not constants. They are worked out from the step data by `playbackDurationMs(id)`. This function groups a scenario's steps into shots the same way the runner does. For each shot it adds the comet timeline's worst-case length from the new `shotTimelineMs`, plus 100ms for the hand-off between shots.

The last DemoActions are now wired in App. `toggleLegend` opens and closes `OVERLAY.mapOwnership` through the overlay manager. `openIncident` now uses `handlePlayScenario`, so the incident starts playing on its own. `pressIntro` clicks the intro's own "Jump in" button, so the intro fades and unmounts exactly as it does for a real click. The Ownership button now has `data-demo-target="legend-ownership"`.

Checks:
- `npm run typecheck`: clean. This covers every workspace.
- `npm run lint`: 0 errors. There is 1 warning at `Map.tsx:814` (exhaustive-deps). It was already there.
- Client tests: 18 files, 133 tests pass. `scripts.test.ts` checks that `ai` ≤ 60s and `all` ≤ 120s. It also checks that every step kind has a handler and every target is known. It confirms that the scenario and incident steps take their times from `playbackDurationMs`, and that the shortened answer gets its full reveal time. It plays the whole `all` run under fake timers with no fetch. `demoTargets.test.tsx` now renders `ProjectCosmosMap` and resolves every target of both scripts, `legend-ownership` included.
- `npm run build --workspace client`: succeeds. The large-chunk warning was already there.

Not verified in a browser, on desktop or on a phone. The real-time playback is not verified; the stage 13 recorder is the backstop for that.

## Commit message
feat(demo): add demo=all tour with data-derived playback timing

The full tour must fit in 120s even when scenario data changes, so the
scenario and incident waits are derived from step data via the comet
timeline bound instead of hard-coded.

## Key decisions
- **Segment times (ms):** intro 4,000 · domains 8,000 · "Place an order" **45,200** (the plan said 30,000) · steps 10,000 · incident `INCIDENTS[0]` = `hub-silence-2026-07-19` **16,000** (the plan said 20,000) · ownership 10,000 · shortened AI 19,400 · end card 4,000. That totals **116,600** against a 120,000 limit. The scenario is much longer than the plan assumed. That only leaves 3.4s spare, so adding about two steps to `shopping.place-order` or to the newest incident will make `scripts.test.ts` fail. That failure is the intended protection.
- **Why the times are upper bounds:** `shotTimelineMs` (in `CometPackets.tsx`) measures a shot at speed 1 up to the end of the last leg's longest possible stardust fade. The stardust fade uses the new named constants `STARDUST_FADE_IN_S` + `STARDUST_MAX_LIFE_S`. The real timeline uses a random lifetime between 0.9 and 1.7s, so real playback usually finishes a bit before the wait ends. The playback length assumes the realtime-hub is not expanded.
- **`pressIntro` clicks the intro button:** It uses `.click()` on `[data-demo-target="intro-start"]`. It does not call `handleIntroStart`, because that only starts the warp. The intro's own `handleStart` also sets `exiting` and schedules `onExitComplete`. Without it the intro would never unmount. The honest fix inside the 6-file ceiling was to press the button, instead of adding a new prop to `IntroOverlay` (which would have been a 7th file). A programmatic click is untrusted and sends no `pointerdown`, so it does not abort the run. Once the button is disabled the click does nothing, so the step is idempotent under StrictMode's double-fire. The `DemoActions` doc comment in `types.ts` ("never by dispatching DOM events") was not updated. The App comment explains the exception.
- **Shortened AI segment:** it is `AI_DEMO_SCRIPT` without steps 0, 1, 12 and its final `endCard`. The answer step lasts `ceil(thinkingMs + words × wordMs)` = **7,600ms**, not the plan's 7,000. At 7,000 the last words would be cut off when the end card replaces the answer panel on desktop. That segment is 19,400ms, which is under the plan's 25,000 budget.
- **`?speed=` does not change scenario or incident playback:** those run on the scenario runner's own speed, which stays at 1. At `speed>1` the demo moves on before the comet finishes. It is not broken, because the next step interrupts it. The stage 13 recorder should use speed 1.
- **Steps with no pointer target:** `playScenario` and `openIncident` have none, because there is no demo target for a scenario chip or an incident list item. The ownership toggle is driven through `OVERLAY.mapOwnership` from App. It does not clear the Map's inspector selection the way the button does, but the demo never selects anything.
- **Stage 13:** `html[data-demo-state="done"]` is set about 116.6s after load, plus React commit drift. Leave enough headroom in the recorder's timeout, for example 150s. The end card stays open after `done`.
- **Stage 14:** new exports in `scripts.ts`: `ALL_DEMO_SCRIPT`, `buildAllDemoScript`, `ALL_DEMO_SCENARIO_ID`, `playbackDurationMs`, `scriptedAnswerDurationMs`. `DEMO_SCRIPTS` and `DEMO_TIME_LIMITS_MS` are now full `Record<DemoModeName, …>`.
