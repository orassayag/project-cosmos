## Files
README.md
CLAUDE.md
.claude/status/stage-4-report.md

## Summary
Checklist:
- README commands vs package.json scripts: FAIL-fixed. `lint` is `eslint .` and eslint.config.mjs also lints `scripts/**/*.mjs`, but README/CLAUDE.md said client/server/drift-sync only; added `scripts/`. The `sync`/`sync:*` scripts were undocumented in the command table; added one pointer row. All other rows match.
- Env vars documented vs used: FAIL-fixed. `AI_COOKIE_SECRET`, `AI_GATEWAY_API_KEY` match server/src/config.ts and server/.env.example. `BASE_URL` (scripts/record-demo.mjs) was undocumented; added to Demo tours. `ANTHROPIC_API_KEY`, `GH_TOKEN`, `DEBUG_CLONE`, Slack webhook are covered in drift-sync/README.md. Not documented anywhere (left, drift-sync internal fallback): `VITE_ANTHROPIC_API_KEY`.
- Routes and keyboard shortcuts vs UI: PASS. /api/ai/{connect,disconnect,status,ask} match server/src/app.ts; keys / Space arrows P B H O C L + - 0 Esc match App.tsx, Map.tsx, Spotlight.tsx, useMapView.ts (C gated on hasDrift, as documented); deep-link params domain/scenario/step/incident/demo/speed match useDeepLink.ts and demoMode.ts.
- Folder tree README/CLAUDE.md vs disk: FAIL-fixed. README tree lacked `client/src/overlays/`, `pages-redirect/`, `skills/`, `docs/`; added. CLAUDE.md said `.claude/skills/` holds only add-service/add-scenario; `update` also exists; fixed.
- Deploy steps vs vercel.json and workflows: PASS. Services client/server, git auto-deploy off, `/api` rewrite, pages.yml redirect-only, validate-on-pr runs lint/build/drift-sync tsc/test/validate on PR + push to main, cosmos-sync gated by DRIFT_SYNC_ENABLED (off by default) all match README.

Gates (repo root): build PASS, typecheck PASS, lint PASS (0 errors, 1 pre-existing react-hooks/exhaustive-deps warning at client/src/map/Map.tsx:814, untouched), validate PASS (0 drift). `npm test` not run: no demo docs/code changed.

## Commit message
docs(readme): fix docs-vs-code mismatches from audit

Audit of README/CLAUDE.md against code: commands FAIL-fixed (lint scope, sync row), env vars FAIL-fixed (BASE_URL), routes/shortcuts PASS, folder tree FAIL-fixed (overlays, pages-redirect, skills, docs, update skill), deploy PASS.
Docs now match what eslint, record-demo and the disk actually contain.

## Key decisions
- Fixed docs to match code; no code changed.
- No comments added; versions/*.md untouched.
- Left the "so forks don't run a failing cron" wording in .github/workflows/cosmos-sync.yml (it describes third-party copies, not this repo's origin; workflows out of stage scope).

## Open questions
- `VITE_ANTHROPIC_API_KEY` fallback in drift-sync/scripts/sync.ts and lib/agent.ts is undocumented; document it in drift-sync/README.md or drop it? Not verified whether it is still used.
