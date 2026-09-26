## Files
client/src/components/DemoEndCard.tsx
client/src/components/__tests__/DemoEndCard.test.tsx
client/src/overlays/OverlayManager.tsx
client/src/App.tsx
client/src/styles/app.css
client/src/styles/responsive.css

## Summary
Adds the demo's closing credit card. It reads "Built by Or Assayag · GitHub · LinkedIn". GitHub points to the repo page built from the root `package.json` `repository.url`. LinkedIn points to `https://www.linkedin.com/in/orassayag/`. Both links open in a new tab with `rel="noopener noreferrer"`.

The card opens on the script's `endCard` step and stays open after the run finishes. You can close it with its top-right close button, which shows on every viewport, or with Esc or a click on the backdrop. On phones it joins the "one card at a time" policy at the top, next to the Connect window, so it hides the stage panels and the demo caption behind it.

Checks:
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors. The one existing warning in `Map.tsx` was already there.
- Client tests: 18 files, 123 tests pass, including the new `DemoEndCard.test.tsx` (5 tests).
- `npm run build --workspace client`: succeeds.

I did not check it in a browser, on mobile or desktop.

## Commit message
feat(demo): add end card crediting the author with GitHub and LinkedIn links

The demo recording needs a closing credit that stays up after the run ends.
It joins the overlay manager as OVERLAY.demoEndCard and has a corner close
button on every viewport, since that close is its only way out.

## Key decisions
- `OVERLAY.demoEndCard = 'demo-end-card'`. `DemoEndCard` reads its visibility from `useOverlay()`, following the same pattern as `ConnectAgentModal`, and is portaled to `<body>`. It is mounted only in App's shell branch, inside `OverlayProvider`, and only when `demoScript` is set. It cannot mount in the intro branch because that branch has no provider.
- The card opens directly from the `showEndCard` action, which calls `demoView.requestEndCard()` and then `overlay.open(OVERLAY.demoEndCard)`. It does not use an effect on `isEndCardRequested`, so it never reopens itself after the user closes it. `isEndCardRequested` is still set and still survives `reset()`, but nothing reads it at the moment.
- On desktop the overlay manager has a single slot, so opening the end card closes the answer panel. On phones the card stacks on top, and closing it brings the answer panel back.
- The card reuses the `.lc-help-overlay`/`.lc-help-modal`/`.lc-help-close` styles. It has its own close button, so it does not need `PanelCloseButton`, which only shows on phones. `.lc-demo-end-overlay` sits at z-index 240, above the pointer (230) and caption (220), which are still on screen during the 4s `endCard` step. Because the backdrop has the `.lc-help-overlay` class, App's Esc-reset of the whole map is skipped while the card is open.
- A trusted click on the card's close button during the `endCard` step also aborts the run. That is harmless: the teardown does not touch the end card.
- The GitHub URL comes from `import { repository } from '../../../package.json'`. Only that one field ends up in the bundle. `toRepositoryWebUrl` strips the `git+` prefix and the `.git` suffix.
- Stage 12: `demo=all` gets the end card simply by ending with an `endCard` step. No other wiring is needed.
