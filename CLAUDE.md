# The Cosmos — notes for Claude Code

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
