# Project Cosmos — notes for Claude Code

## Commands

```bash
npm run dev        # client dev server on :5173
npm run dev:client # client dev server on :5173 (plain Vite)
npm run build      # every workspace (client: tsc -b && vite build) — the gate for every change
npm run typecheck  # every workspace, no emit
npm run lint       # eslint over client/, server/, drift-sync/
npm run snapshot   # regenerate server/src/generated/cosmos-map.json from the map data
npm run validate   # data sanity: ids resolve, phaseIds unique, spacing ok, snapshot fresh
```

Run from the repo root — it is an npm workspaces root (`client/`, `server/`).

**Never run `tsc` without `--noEmit`/`-b`** — emitted `.js` files shadow `.tsx` in Vite (`client/`) and the app silently serves stale code.

## Layout

- `client/src/scenarios/` — the entire universe as typed data: `services.ts`, `topics.ts`, `scenarios.ts` (domains + scenarios), `owners.ts` (teams), `steps/<domain>.ts`, barrel in `data.ts`. **Most changes belong here.**
- `client/src/incidents/` — recorded production incidents (frozen scenarios with inline steps). One file per incident, registered in `incidents/data.ts`; discovered, listed, and played automatically. `phaseId` `101+` so they never collide with scenarios.
- `client/src/map/` — SVG map rendering: `Map.tsx` (orchestration, layout edit mode), `edge-resolver.ts` (how a step becomes edges; special-cases the expandable `realtime-hub`), `edge-builder.ts` (bezier geometry).
- `client/src/components/` — UI shell: intro, playback controls, step panel, tech icons.
- `server/` — Node service workspace. `server/src/generated/cosmos-map.json` is a committed snapshot of the map data (written by `npm run snapshot`, checked by `npm run validate`); commit it with every data edit.
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
- Service `hex` must match its `color` CSS token hue (`client/src/styles/tokens.css`); topics always `TOPIC_COLOR`/`TOPIC_HEX`.
- World is 2400×1400; capsules ≥150px apart center-to-center.
- Demo data is fictional (AstroMart). Keep it that way — no real company names/endpoints.

## Demo tours (`?demo=ai`, `?demo=all`)

The scripted tours live in `client/src/demo/scripts.ts` (steps), `client/src/demo/scriptedAnswer.ts`
(the AI question + answer), and are recorded with `npm run record:demo -- ai|all`.

- **The tours drive the real UI (invariant).** Every step is a viewer gesture (`click` / `type` / `paste`
  on a `data-demo-target`): `runDemo.ts` glides the pointer there and dispatches the same pointer, mouse,
  keyboard and input events a person would, so all changes go through the app's own handlers. Never add a
  step that sets app state directly. Only two things are faked: the AI connection (`useDemoAiConnection`
  accepts the fake keys, no network) and the answer (`DEMO_SCRIPTED_ANSWER`, via `handleAsk`). Scripts are
  built per layout (`buildDemoScript(mode, { isPhone })`) — on phones the pickers sit in the drawer.
- **Every important new feature joins `demo=all` in the same change (invariant).** Add a segment to
  `buildAllDemoScript()` (plus any `data-demo-target` attribute it needs).
  The tour must stay ≤120s (`scripts.test.ts` guards it) — trim other segments to make room rather than
  skipping the feature.
- **Every AI change is reflected in `demo=ai` in the same change (invariant).** Any change to the Ask /
  Connect-agent flow, providers, or answer behaviour updates `buildAiDemoScript()` and/or
  `DEMO_SCRIPTED_ANSWER` so the tour shows the current behaviour; it must stay ≤60s.
- After a demo change, run `npm test` and re-record both modes to confirm they finish under their limits.

## Responsive / mobile

**Mobile-first (invariant).** Every new feature is built and verified on a phone-class
viewport FIRST, then checked on desktop — never the other way around. Design the layout,
panels, and controls to work at ~390px wide (and short landscape) before widening to the
desktop presentation. A feature isn't done until it's been looked at on mobile.

**One panel at a time (invariant).** Panels / popups / windows must never stack or overlap
on mobile. Two cards must not render on top of each other — a detail card (inspector, ask,
health card) hides the context panels (legends, step/incident narration) behind it; see the
"One card at a time" block in `responsive.css`. Any new panel joins that priority policy.

The responsive layer lives in `client/src/styles/responsive.css` (loaded last) plus the
`useViewport` hook (`client/src/hooks/useViewport.ts`), which mirrors the breakpoints onto
`<html data-viewport data-touch>`. Phone-class = `max-width:768px` **or** `max-height:480px`
(catches landscape phones); the JS query and the CSS media query must stay in sync.

**Mobile close-button contract (invariant).** On phone-class viewports **every** floating
panel / popup / modal MUST have a close control in its top-right corner — existing *and*
future ones. Satisfy it one of two ways:
- The panel already has its own header close button (inspector, step panel, help,
  changelog, ask, health card, mobile menu). Leave it.
- Otherwise render `<PanelCloseButton onClose={…} />` (`client/src/components/PanelCloseButton.tsx`).
  It emits `.lc-panel-x`, hidden on desktop and revealed on phones by `responsive.css`. The
  map legends (ownership / changes / blast / health) and the incident banner use this.

Any new panel added later must ship with one of the two — this is the "new panel" checklist item.
