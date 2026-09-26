# Stage 9 work brief — Fake pointer, caption bar, responsive rules, App mount

**Stage line:** A1/A3: DemoPointer.tsx + DemoCaption.tsx + responsive.css (pointer hidden on touch, caption behind detail cards) + App mount

## Scope for THIS stage
- New `client/src/components/DemoPointer.tsx` (A1 pointer component only).
- New `client/src/components/DemoCaption.tsx` (A3 caption bar).
- CSS for both (pointer + caption base styles in the appropriate existing stylesheet, phone rules in `client/src/styles/responsive.css`: pointer hidden on touch/phone-class, caption above playback controls on phones and hidden while a detail card is open — join the "One card at a time" block).
- Mount both in `client/src/App.tsx`, driven by `demoRunner.caption`, `demoRunner.target`, `demoRunner.isOverlayVisible`, and `demoSpeed` (see ledger Stage 8).
- Tests for the two components are welcome (e.g. caption renders text with `aria-live="polite"`; pointer computes position from a `[data-demo-target]` element's rect and does nothing when absent) if they fit the ceilings.

**Out of scope (later stages):** adding `data-demo-target` attributes to app elements (stage 10 — until then the pointer simply finds no element and must stay put/hidden gracefully); DemoEndCard (stage 11); `demo=all` + `toggleLegend` (stage 12); recorder (stage 13).

## Plan text (verbatim)

### §1 — Runner (excerpt)
- `types.ts` defines a typed step union. Every step has `durationMs` and an optional `caption`
  (A3): … `target` names a `data-demo-target` attribute that the pointer moves to (A1).
- Abort (I8): `useDemoRunner` owns one `AbortController`. … On abort or on finish it hides the pointer and
  caption, drops the fake AI connection back to the real one (§3), and sets
  `<html data-demo-state="aborted" | "done">`, which A4 waits for.

### §8 — Accepted additions (A1, A3, A5)
- **A1 — Fake pointer.** `DemoPointer.tsx` is one absolutely positioned SVG arrow in a portal.
  Before each targeted step, it moves over 500ms to the center of
  `document.querySelector('[data-demo-target="…"]').getBoundingClientRect()`, then shows a 300ms
  ripple. Add `data-demo-target` to: the Connect button, the provider buttons, the key fields,
  the Connect submit, Search, domain buttons, play/step controls, the legend toggle, and the
  intro button. The pointer is hidden on phones (touch has no cursor) and has
  `pointer-events: none`. Verify: visual, in the A4 recording.
- **A3 — Captions.** `DemoCaption.tsx` is a one-line bar at the bottom center with
  `aria-live="polite"`. It shows the current step's `caption` and keeps the last one until a new
  caption replaces it. It is a caption strip, not a panel. On phones it sits above the playback
  controls and is hidden while a detail card is open, following the "one card at a time" block
  in `responsive.css`. Verify: visual at 390px and desktop.
- **A5 — Speed dial.** `?speed=` is parsed in §1, and the runner divides every duration by it.
  The pointer and caption animations scale too. Covered by `runDemo.test.ts`.

### §10 — Screens (I10)
The demo is **recorded on desktop (1920×1080) and must not break on phones.** It is built and
checked at 390px first, per the mobile-first invariant:
- The caption hides behind detail cards (A3), and the end card has its close button (A2).
- The pointer is hidden on touch devices.
Verify manually at 390×844 portrait and 844×390 landscape with `?demo=ai&speed=4`.

## Project invariants (CLAUDE.md) that apply
- Mobile-first; phone-class = `max-width:768px` **or** `max-height:480px`; JS (`useViewport`) and CSS queries stay in sync.
- One panel at a time on mobile — see "One card at a time" block in `responsive.css`.
- The caption is a strip, not a panel, so it does not need a close button; the pointer is not interactive (`pointer-events: none`).
- Never run `tsc` without `--noEmit`/`-b`. Gate: `npm run build`, `npm run typecheck`, `npm run lint`, client tests.

## Notes from the ledger
- Stage 8: read `demoRunner.caption`, `demoRunner.target`, `demoRunner.isOverlayVisible` in App (the `demoRunner` const), use `demoSpeed` for animation scaling. `target` is sticky until a later step replaces it; `closeConnect` has no target.
- Stage 10 will add `data-demo-target` attributes; the runner never touches them.
