# Stage 14 work brief — Final acceptance

Stage plan line: Final acceptance: /test, record:demo ai + all under limits, 390×844 / 844×390 manual check, no-`?demo=` regression check

This is a verification stage. Change code ONLY to fix a genuine acceptance failure, minimally, within the plan's scope. If everything passes, the Files list may be just the report.

## Plan sections (verbatim from docs/plans/demo-plan.md)

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

## Carry-over notes from stage 13 (ledger)
- `all` real run took 117.4s vs 120s limit — warm Vite with one throwaway run before the acceptance run.
- Port 5173 was held by a foreign Vite process returning 404 on `/`. Do not kill processes you did not start; start the client on another port and pass BASE_URL.
- The `aborted` path (trusted click mid-demo) was never exercised — this stage must verify 'Clicking anywhere mid-demo stops it, and the app is fully usable afterwards' (Playwright real click is trusted input).
- Videos were never watched against the §6/§7 tables — sample frames (e.g. ffmpeg if available, or Playwright screenshots at timed points) to confirm the sequence.
