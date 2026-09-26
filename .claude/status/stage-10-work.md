# Stage 10 work brief — `data-demo-target` attributes

**Stage line:** A1: `data-demo-target` attributes on Connect, provider, key fields, submit, Search, domain buttons, play/step controls, legend toggle, intro button

## Scope for THIS stage
- Add `data-demo-target="<id>"` attributes to the app elements listed in A1, using exactly the ids defined in `DEMO_TARGETS` / `DemoTarget` in `client/src/demo/types.ts` (stage 1). If A1 names an element with no matching id in `DemoTarget` (e.g. step back/forward, legend toggle, intro button, play), add the id to `DemoTarget`/`DEMO_TARGETS` so stage 12's `demo=all` script can target it — keep naming consistent with existing ids.
- Put each attribute on the **visible element whose centre should be "clicked"** (the button/input itself), never on a wrapper — the stage 9 pointer reads the rect of that exact element, and a zero-size/`display:none` element counts as missing.
- Per-item ids where there are several (provider buttons, domain buttons, key fields) must be distinguishable so a script can target one specific item (e.g. a Claude provider button vs. others, the Claude key field vs. the JEV key field, the `shopping` domain button). Follow whatever id shape `DemoTarget` already uses for these.
- Every `target` used in `AI_DEMO_SCRIPT` (`client/src/demo/scripts.ts`) must resolve to a real element with this stage. Add/extend a test that locks this: at minimum, a test asserting each rendered component carries the expected `data-demo-target` (component tests already exist for ConnectAgentModal, AskAgent, AskPanel — extend those rather than creating parallel ones where it fits).
- Attributes are inert (no behaviour change, no styling change). Must work at phone width too (attributes are harmless there; pointer is hidden on touch).

**Out of scope (later stages):** DemoEndCard (stage 11); new DemoActions / `demo=all` script (stage 12 — this stage only makes the targets exist); recorder (stage 13). Do not touch `DemoPointer.tsx`/`DemoCaption.tsx` unless an id rename forces it.

## Plan text (verbatim)

### §1 — Runner (excerpt)
- `types.ts` defines a typed step union. Every step has `durationMs` and an optional `caption`
  (A3): `{ kind: 'pressIntro' | 'pickDomain' | 'type' | 'openConnect' | 'pickProvider' | 'paste' |
  'connect' | 'closeConnect' | 'ask' | 'answer' | 'playScenario' | 'stepBack' | 'stepForward' |
  'openIncident' | 'toggleLegend' | 'wait' | 'endCard'; target?: DemoTarget; … }`.
  `target` names a `data-demo-target` attribute that the pointer moves to (A1).

### §6 — `demo=ai` script (excerpt)
Each step that clicks something has a `target`, so the A1 pointer glides there first (inside the
step's time). Steps: pickDomain `shopping`, type question, openConnect (pointer → Connect), pickProvider Claude, paste Claude key, paste JEV key, connect (busy → connected), closeConnect, ask (Search pressed), answer, endCard.

### §7 — `demo=all` (excerpt, for which targets stage 12 will need)
Segments: pressIntro + warp; domain switch Shopping → Fulfillment → Shopping; play "Place an order"; step back ×2, forward ×2; open a recorded incident; ownership legend on, hold, off; shortened `demo=ai` sequence; endCard.

### §8 — A1 — Fake pointer
`DemoPointer.tsx` is one absolutely positioned SVG arrow in a portal.
Before each targeted step, it moves over 500ms to the center of
`document.querySelector('[data-demo-target="…"]').getBoundingClientRect()`, then shows a 300ms
ripple. Add `data-demo-target` to: the Connect button, the provider buttons, the key fields,
the Connect submit, Search, domain buttons, play/step controls, the legend toggle, and the
intro button. The pointer is hidden on phones (touch has no cursor) and has
`pointer-events: none`. Verify: visual, in the A4 recording.
