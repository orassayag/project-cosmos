# Stage 9 report — Fake pointer, caption strip, phone rules, App mount

## Files
client/src/components/DemoPointer.tsx
client/src/components/DemoCaption.tsx
client/src/components/__tests__/DemoPointer.test.tsx
client/src/components/__tests__/DemoCaption.test.tsx
client/src/styles/app.css
client/src/styles/responsive.css
client/src/App.tsx

## Summary
While a demo runs, two new overlays now show. The first is a fake mouse pointer. It glides to the element the current step names, then shows a small click ripple. The second is a one-line caption strip at the bottom centre of the screen that narrates each step. Screen readers announce it politely. `?speed=` speeds up the pointer's glide, the ripple, and the caption fade too. When the demo ends or is stopped, both overlays disappear.

On phones and touch devices the pointer never shows, because touch has no cursor. On phones the caption sits at the bottom edge. It hides whenever a detail card or a narration panel is open, so it never stacks on top of one. On every screen size, the caption moves up above the playback controls when they are showing.

Both overlays are rendered into `<body>` and are stacked above the Connect window. This way the desktop recording shows them over it. Neither ever takes a click.

Until stage 10 adds the `data-demo-target` attributes, no step target exists on the page. So the pointer stays hidden during a real run today. When a target is missing, the pointer stays where it was and never jumps to a made-up position. The caption already works.

Checks:
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors. The 1 warning in `client/src/map/Map.tsx` was already there; I did not touch that file.
- Client tests: 115/115 pass across 16 files, 7 of them new.
- `npm run build`: succeeds.

**Not looked at in a browser** (phone or desktop). The layout and phone rules have only been checked by reading the CSS and through the component tests.

## Commit message
feat(demo): add the demo's fake pointer and caption strip

A recorded demo needs to show where each step "clicks" and to explain it in
words. The pointer is desktop-only because touch has no cursor. On phones the
caption gives way to detail cards, so panels never stack.

## Key decisions
- **Both overlays are portaled to `<body>`, at z 230 (pointer) and z 220 (caption).** The Connect window is also portaled, at z 200, and `.lc-app` is a fixed stacking context. Anything rendered inside the shell could never appear over the modal. As a result, the phone "hide caption" rule uses `body:has(...)`, like the existing connect-modal rule, not `.lc-stage:has(...)`.
- **The caption clears the playback controls by measuring them in JS.** `--lc-controls-h` is set on `.lc-stage`, which a body portal does not inherit. The caption re-measures `.lc-controls` on each caption change and on resize. A step that starts a scenario mounts the controls in the same render as its caption, so the measurement lines up. If the controls appear or resize in the middle of a step, the caption only catches up at the next caption change.
- **On phones the caption also hides behind `.lc-step-panel` and `.lc-incident-panel`, not only behind detail cards.** On phones those narration panels sit directly above the transport bar. A caption placed "above the controls" would overlap them, and narration already tells the story. The caption joins the bottom of the "One card at a time" priority list, below legends. It is a strip, so it has no close button.
- The pointer hides on phones and touch devices in two places. The component checks `useViewport().isMobile || isTouch`. CSS backs this up with `html[data-touch='true']` and the phone media query.
- **Pointer motion:** on its first appearance, the pointer starts at the lower middle of the viewport, stays there for one painted frame, and then glides. The glide uses a double `requestAnimationFrame`, so the first move animates instead of jumping. It also follows its target on window resize.
- **The pointer remounts when App switches from the intro branch to the shell branch.** App returns early during the intro, so `demoOverlays` is rendered in both branches. After the warp, the pointer glides in from the start position again. This only affects `demo=all`.
- **Stage 10 (target attributes):**
  - The pointer looks up `document.querySelector('[data-demo-target="<id>"]')` when a step starts, using the ids in `DEMO_TARGETS`.
  - A zero-size element counts as missing. Hidden elements such as `display:none` are ignored, and the pointer stays put.
  - Put the attribute on the element whose centre should be "clicked". For example, put it on the visible button, not on a wrapper.
  - The rect is read once per step, two animation frames after the step starts. Elements that animate in, such as the Connect modal's scale-in, are measured mid-animation if they are targeted in the same step that opens them. In `AI_DEMO_SCRIPT`, `openConnect` targets `connect-open` in the topbar, which is fine.
- **Stage 11 (end card):** once the run ends, `demoRunner.isOverlayVisible` is false, so the pointer and caption are already gone when the end card opens. Nothing needs to hide them. The caption's z 220 and the pointer's z 230 are above the Connect window's z 200. If the end card must cover them while the demo is still running, it needs a z-index above 230. It does not need that if it only opens after the run.
- **Stage 12 (`demo=all`):** captions show during the intro branch too, because the overlays mount in both App branches. On phones, a playing scenario's step panel hides the caption. That is intended.

## Open questions
None.
