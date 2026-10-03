# Stage 1 blocker — `npm run lint` crashes on the committed lockfile

**Needs a human decision. Not fixed by this stage (dependency change = out of Phase 0 scope).**

## What happened

- Baseline gates at HEAD `0dc2b6e` (feature/add-ai) were all green, including `npm run lint` (0 errors, 1 pre-existing warning).
- That lint run used a **stale local `node_modules`**: commit `a86f10b` ("Update outdated packages") bumped `typescript` `^6.0.3` → `^7.0.2` in `package.json` / `package-lock.json`, but the local install still had TS 6.
- Phase 0 adds `pixelmatch` + `pngjs` (dev). `npm install` reconciled `node_modules` to the committed lock, installing `typescript@7.0.2`.
- With TS 7, `npm run lint` now crashes before linting anything:
  `Error: typescript-eslint does not support TS 7.0.` (typescript-eslint 8.71.0).
- The lockfile diff from this stage is only the two new packages — the TS 7 pin was already committed.
- `npm install` also needed `--legacy-peer-deps`: plain `npm install` fails with ERESOLVE on the same conflict (typescript-eslint's peer range vs TS 7).

## Impact

CI is already red on `main` because of it: the last three "Validate Project Cosmos" runs on `main` (e.g. run 36961974815, 2026-10-02) fail at `npm ci` with `ERESOLVE could not resolve … typescript-eslint@8.71.0 … Found: typescript@7.0.2` (peer range `>=4.8.4 <6.1.0`). Locally, once node_modules matches the lock, `npm run lint` crashes as above. Pre-existing, not caused by Phase 0 — but the plan says "Red `main` → stop", and the per-commit lint gate cannot pass until it is resolved. The local "green" baseline was only green because of the stale TS 6 install.

## Options

1. Pin `typescript` back to `^6.0.3` (root `package.json`) until typescript-eslint supports TS 7 — smallest change.
2. Keep TS 7 for `tsc` and run typescript-eslint against a side-by-side TS 6 install (per the typescript-eslint error message link).
3. Upgrade typescript-eslint when a TS 7-compatible release exists.

Default if unanswered: none applied — this stage leaves dependencies as committed.
