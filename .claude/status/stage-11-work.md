# Stage 11 work brief — A2: DemoEndCard

Stage-plan line: "Stage 11: A2: DemoEndCard.tsx + OVERLAY.demoEndCard + close button + DemoEndCard.test"

## Plan excerpt (docs/plans/demo-plan.md, §8 A2 — verbatim)

- **A2 — End card.** `DemoEndCard.tsx` reads "Built by Or Assayag · GitHub · LinkedIn". The
  GitHub link points to the repo, using the URL from `package.json` `repository`. The LinkedIn link is
  `https://www.linkedin.com/in/orassayag/`. The card joins the overlay
  manager as `OVERLAY.demoEndCard` and has a top-right close button (mobile close-button
  contract). It stays open after the run finishes. Test: `DemoEndCard.test.tsx` renders both
  links with `rel="noopener noreferrer"`, and close calls the overlay close.

## Plan excerpt (§10 Screens — verbatim)

The demo is **recorded on desktop (1920×1080) and must not break on phones.** It is built and
checked at 390px first, per the mobile-first invariant:
- The Connect window and the answer panel never show at the same time. The overlay manager
  already stacks them, and closing the Connect window restores the answer panel.
- The caption hides behind detail cards (A3), and the end card has its close button (A2).
- The pointer is hidden on touch devices.

## Plan excerpt (§6 — endCard step)

| 13 | endCard | 4000 | — |  (last step of the `demo=ai` script; `demo=all` also ends with endCard, stage 12)

## Project invariants that apply (from CLAUDE.md)
- Mobile-first; "one panel at a time" on phones — any new panel joins the priority policy in the
  "One card at a time" block of `client/src/styles/responsive.css`.
- Mobile close-button contract: the card has its own header close button, or renders
  `<PanelCloseButton onClose={…} />` (`client/src/components/PanelCloseButton.tsx`). The plan asks for a
  top-right close button visible on all viewports (it is the only way to dismiss the card) — pick
  whichever satisfies that.
- Demo data is fictional, but the end card's author credit/links are real by design (plan A2).

## Ledger pointers for this stage
- Stage 8: open `OVERLAY.demoEndCard` from `demoView.view.isEndCardRequested` (survives `reset()`);
  teardown closes `OVERLAY.connect`/may close `OVERLAY.ask`, not the end card.
- Stage 9: an end card that must cover pointer/caption while running needs z > 230; not needed if it
  opens after the run (overlays are already gone then).
