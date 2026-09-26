# Stage 10 report — `data-demo-target` attributes

## Files
client/src/components/AskAgent.tsx
client/src/components/ConnectAgentModal.tsx
client/src/components/DomainBar.tsx
client/src/components/PlaybackControls.tsx
client/src/components/IntroOverlay.tsx
client/src/demo/__tests__/demoTargets.test.tsx

## Summary
The demo's fake pointer now has real things to point at. The app's buttons and fields now carry a hidden `data-demo-target` label that the pointer looks up. The labelled elements are:
- the question box, the Search button, and the "Connect AI Agent" button
- the two provider buttons, the provider key field, the JEV key field, and the Connect submit button
- the three domain tabs
- the play, step-back, and step-forward controls
- the intro's "Jump in" button

When `?demo=ai` runs, the pointer now glides to each step's control and ripples on it. Every target the AI demo script uses points at exactly one element.

The labels change nothing else: no behaviour, no styling, no layout. Phones are unaffected because the pointer is hidden there anyway. Each label sits on the visible button or input itself, never on a wrapper, so the pointer lands on the control's centre.

One item from the A1 list is not done: the ownership legend toggle (`legend-ownership`). That button lives in `client/src/map/Map.tsx`. Adding it would have gone over the 6-file ceiling, and Map.tsx is already far over the 300-line ceiling. Stage 12 has to edit Map.tsx anyway to wire `toggleLegend`, so the label fits there (see Open questions).

A new test renders every demo-facing component together. It checks that each target in the AI demo script resolves to exactly one element, and that every other known target except `legend-ownership` is on a button, input, or textarea. I added one cross-component test instead of extending the AskAgent and ConnectAgentModal tests, because that fit within the file ceiling. The test fails if anyone renames or drops one of these attributes.

Checks:
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors. The 1 warning in `client/src/map/Map.tsx` was already there; I did not touch that file.
- Client tests: 118/118 pass across 17 files; 3 of the tests are new.
- `npm run build`: succeeds.

**Not looked at in a browser.** The pointer actually landing on each control has not been seen; only the DOM attributes are tested.

## Commit message
feat(demo): tag demo-clickable controls with data-demo-target

The fake pointer finds what each demo step "clicks" by a data attribute.
Without these labels it had nowhere to go, so it stayed hidden. A test
locks every AI-demo target to exactly one real element.

## Key decisions
- **Provider and domain ids are built from the data:** `connect-provider-${option}` (type-checked with `satisfies DemoTarget`) and `domain-${d.id}`. `DomainBar`'s `d.id` is a plain `string`, so domain ids are guarded only by the test, not by the compiler. No new ids were needed; every A1 item already had one in `DEMO_TARGETS`.
- **`connect-open` is on the Ask box's "Connect AI Agent" button.** This is the only Connect entry point. It renders only while the Ask box is expanded and disconnected. The AI script keeps `demoExpanded` on through that step, so it is present when the pointer looks for it.
- **`playback-play` is on the play/pause/restart button** (one element, whose label changes). The step dots and speed pills have no ids.
- **For stage 12:**
  - Add `data-demo-target="legend-ownership"` to the Ownership button in `client/src/map/Map.tsx` (the `lc-layout-btn` whose `onClick={toggleOwnershipMode}`, about line 1178). Then remove `'legend-ownership'` from `TARGETS_OUTSIDE_THESE_COMPONENTS` in `demoTargets.test.tsx`, so the test covers every `DEMO_TARGETS` id.
  - The domain tabs render once, in the topbar on desktop and inside the mobile drawer on phones, so `querySelector` never finds a hidden duplicate.
  - `intro-start` exists only while the intro is mounted, which is right for `pressIntro`.
- **For stage 11:** nothing here affects the end card.

## Open questions
- `legend-ownership` has not been added yet: it lives in the oversized `client/src/map/Map.tsx` and would have been a 7th file. I propose that stage 12 add it, since stage 12 has to edit Map.tsx to wire `toggleLegend` anyway. This does not block anything now, because `AI_DEMO_SCRIPT` never targets it.
