# Stage 5 report — §5: AskAgent demo props

## Files
client/src/components/AskAgent.tsx
client/src/components/__tests__/AskAgent.test.tsx
client/src/styles/app.css

## Summary
`AskAgent` takes three new optional props. When `demoQuestion` is set, the box shows exactly that text and is read-only. Focusing the box expands it but no longer clears the text, and the Enter and Escape keys do nothing. `demoExpanded` sets the expanded or collapsed state directly, overriding the component's own state. `demoSearchPressed` adds a new `lc-ask-go--pressed` class to the Search button. The class is a small rule in `app.css` that applies to every screen size, phones included. When none of the demo props are passed, the component behaves exactly as before. Five tests were added:
- `demoQuestion` renders and is read-only.
- Focusing the box does not clear the demo text, and no starter questions appear.
- `demoExpanded` plus `demoSearchPressed` show the pressed Search button.
- `demoExpanded: false` keeps the box collapsed even when it is focused.
- Without demo props, focusing still clears the box and Search is not pressed.

Results: `npm --prefix client test` passed (10 files, 83 tests). `npm run typecheck` is clean. `npm run lint` has 0 errors; its one warning is an existing one at `client/src/map/Map.tsx:814`, in a file this stage did not touch.

## Commit message
feat(demo): let the demo type into the Ask box and press Search

The recorded demo has to show a question being typed and searched without a
visitor's focus wiping it (I4). Optional demo props make the Ask box show the
runner's text, expanded state and pressed Search button; real visitors are unaffected.

## Key decisions
- This follows the stage-4 pattern: the internal state was renamed to `isExpandedInternal` / `typedQuestion`, and the values the box renders are `demoExpanded ?? internal` and `demoQuestion ?? internal`.
- "Demo mode" for the box means `demoQuestion !== undefined`. An empty string still counts, so stage 8 should pass `''` at the start of the `type` step, not `undefined`.
- Starter questions are hidden while `demoQuestion` is set. Without this, they would show while the text is empty and then disappear on the first typed character, making the box jump from 180px to its normal height. It also stops a demo run from showing clickable starters that call `onAsk`.
- The pressed look uses a new class rather than an existing one, because no pressed or active class existed for `.lc-ask-go`. It uses an inset shadow instead of `transform`, because the button's entrance animation holds `transform` at its final value (`forwards`), which would override a transform in the pressed rule.
- The Search button only renders while the box is expanded, so stage 8 must keep `demoExpanded: true` through the `ask` step for the pressed state to be visible.
- `app.css` was touched on top of the component and its test. The brief allowed adding a minimal pressed class.
