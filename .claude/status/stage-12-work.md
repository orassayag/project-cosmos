# Stage 12 work brief — §7: `demo=all` script + new DemoActions wired in App + scripts.test (all ≤ 120s)

Plan: docs/plans/demo-plan.md (no spec file for this run). Stage-plan line:
"§7: `demo=all` script (scenario-derived segment 2 time) + new DemoActions wired in App
(pressIntro, playScenario, stepBack/Forward, openIncident, toggleLegend) + scripts.test (all ≤ 120s)"

## Plan §7 — `demo=all` script (≤ 120s) (I2) — pasted verbatim

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

## Plan §9 — Time limits (I9) — pasted verbatim

`client/src/demo/__tests__/scripts.test.ts` builds both scripts and sums `durationMs`. It
asserts `ai ≤ 60_000` and `all ≤ 120_000`. It also asserts that every step `kind` has a handler
in `DemoActions`, and every `target` exists in the `DemoTarget` union. *Protects: a timing edit
cannot silently push a demo over its limit.* Unit layer. The A4 recorder is the real-time
backstop, because the scenario playback in §7 runs on the app's own clock.

## Plan §2 (the `demo=all` part) — pasted verbatim

- `demo=all` keeps the intro, and its step 0 (`pressIntro`) calls the same handler the intro
  button uses. The warp is counted in the time budget (4s).
- In demo mode, `cosmos-intro-seen` is **never** written, so a later normal visit still gets the
  intro.

## Plan §6 — the `demo=ai` table segment 6 shortens (pasted verbatim)

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

Each step that clicks something has a `target`, so the A1 pointer glides there first (inside the
step's time).

## Carry-forward obligations from earlier stages (from the ledger — MUST do in this stage)

- Stage 7: `DEMO_SCRIPTS` / `DEMO_TIME_LIMITS_MS` are `Partial<Record<DemoModeName, …>>` —
  add `ALL_DEMO_SCRIPT`, `all: 120_000`, and switch both to full `Record` (tests iterate all entries).
- Stage 8: keep `all`'s step 0 idempotent (StrictMode double-fires step 0). `toggleLegend` is
  currently a no-op (legend state lives inside `Map`) — **wire it**. `pressIntro`,
  `playScenario`, `stepBack`/`stepForward`, `openIncident` exist — verify they drive the real
  handlers correctly for the `all` tour. `?demo=all` currently has no script (normal load) — this
  stage makes it play.
- Stage 10: add `data-demo-target="legend-ownership"` to the Ownership `lc-layout-btn`
  (`onClick={toggleOwnershipMode}`, ~line 1178 of `client/src/map/Map.tsx`) and remove
  `'legend-ownership'` from `TARGETS_OUTSIDE_THESE_COMPONENTS` in
  `client/src/demo/__tests__/demoTargets.test.tsx`. If the `all` script uses other targets
  (intro-start, domain tabs, playback controls), make sure the target-coverage test covers them.
- Stage 11: `demo=all` gets the end card just by ending with an `endCard` step.

## Mobile-first / project invariants
- Any change must not break phone-class viewports; no new panel is expected in this stage.
- Demo data is fictional (AstroMart).
