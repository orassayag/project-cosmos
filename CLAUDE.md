# Project Cosmos — notes for Claude Code

## Commands

```bash
npm run dev        # dev server on :5173
npm run build      # tsc -b && vite build — the gate for every change
npm run validate   # data sanity: ids resolve, phaseIds unique, spacing ok
```

**Never run `tsc` without `--noEmit`/`-b`** — emitted `.js` files shadow `.tsx` in Vite and the app silently serves stale code.

## Layout

- `src/scenarios/` — the entire universe as typed data: `services.ts`, `topics.ts`, `scenarios.ts` (domains + scenarios), `owners.ts` (teams), `steps/<domain>.ts`, barrel in `data.ts`. **Most changes belong here.**
- `src/incidents/` — recorded production incidents (frozen scenarios with inline steps). One file per incident, registered in `incidents/data.ts`; discovered, listed, and played automatically. `phaseId` `101+` so they never collide with scenarios.
- `src/map/` — SVG map rendering: `Map.tsx` (orchestration, layout edit mode), `edge-resolver.ts` (how a step becomes edges; special-cases the expandable `realtime-hub`), `edge-builder.ts` (bezier geometry).
- `src/components/` — UI shell: intro, playback controls, step panel, tech icons.
- `drift-sync/` — the nightly honesty pipeline (its own README).
- `.claude/skills/` — `add-service` and `add-scenario`: THE documented procedures for growing the map. Follow them rather than improvising.

## Versioning (local change ledger)

Every commit is auto-versioned by a local `.git/hooks/post-commit` hook
(`scripts/version-bump.sh`): it derives a semver bump from the commit type
(Conventional Commits — `feat`→minor, `!`/`BREAKING CHANGE`→major, else patch),
prepends a plain-English row to the per-year ledger `versions/<year>.md`, and tags the
commit `vX.Y.Z`. That tag is what **`/revert <x.y.z>`** restores the whole repo to.

- **Claude writes the version note automatically as the final step of every task, before
  committing** — this is not a manual step for the developer. Summarize the task's real
  changes as one plain-language bullet each, understandable by a non-developer (no jargon,
  no file lists), and pipe them to `scripts/version-note.sh write`. The hook then consumes
  `.git/version-note.md` on the commit. If a row ever lands without a note, restore it with
  `scripts/version-note.sh amend`.
- The ledger is generated — **never edit `versions/*.md` by hand.**
- The hook is local (not tracked). On a fresh clone, install it once with
  `bash scripts/install-hooks.sh`.

## Invariants

- `phaseId` global, unique, never reused; every step's `phase` equals its scenario's `phaseId`.
- Step `from`/`to`/`via`/`through` must exactly match `SERVICES[].id` / `TOPICS[].id`.
- Service `hex` must match its `color` CSS token hue (`src/styles/tokens.css`); topics always `TOPIC_COLOR`/`TOPIC_HEX`.
- World is 2400×1400; capsules ≥150px apart center-to-center.
- Demo data is fictional (AstroMart). Keep it that way — no real company names/endpoints.

## Responsive / mobile

**Mobile-first (invariant).** Every new feature is built and verified on a phone-class
viewport FIRST, then checked on desktop — never the other way around. Design the layout,
panels, and controls to work at ~390px wide (and short landscape) before widening to the
desktop presentation. A feature isn't done until it's been looked at on mobile.

**One panel at a time (invariant).** Panels / popups / windows must never stack or overlap
on mobile. Two cards must not render on top of each other — a detail card (inspector, ask,
health card) hides the context panels (legends, step/incident narration) behind it; see the
"One card at a time" block in `responsive.css`. Any new panel joins that priority policy.

The responsive layer lives in `src/styles/responsive.css` (loaded last) plus the
`useViewport` hook (`src/hooks/useViewport.ts`), which mirrors the breakpoints onto
`<html data-viewport data-touch>`. Phone-class = `max-width:768px` **or** `max-height:480px`
(catches landscape phones); the JS query and the CSS media query must stay in sync.

**Mobile close-button contract (invariant).** On phone-class viewports **every** floating
panel / popup / modal MUST have a close control in its top-right corner — existing *and*
future ones. Satisfy it one of two ways:
- The panel already has its own header close button (inspector, step panel, help,
  changelog, ask, health card, mobile menu). Leave it.
- Otherwise render `<PanelCloseButton onClose={…} />` (`src/components/PanelCloseButton.tsx`).
  It emits `.lc-panel-x`, hidden on desktop and revealed on phones by `responsive.css`. The
  map legends (ownership / changes / blast / health) and the incident banner use this.

Any new panel added later must ship with one of the two — this is the "new panel" checklist item.
