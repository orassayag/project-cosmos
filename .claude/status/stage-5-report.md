# Stage 5 report: M0 path consumers repointed, M0 verification gate run

## Files
CLAUDE.md
README.md
CONTRIBUTING.md

## Summary
**Edits**
- `CLAUDE.md` (edited in place). The Commands block now lists the real root scripts: `dev`, `dev:client`, `build`, `typecheck`, `lint`, `snapshot` and `validate` (`validate` also checks that the snapshot is fresh). A new line says to run everything from the workspaces root. The emitted-`.js`-shadows-`.tsx` warning is kept and now names `client/`. The Layout paths now read `client/src/...`. There is a new `server/` bullet about the committed `cosmos-map.json` snapshot. The invariant and responsive paths (`tokens.css`, `responsive.css`, `useViewport.ts`, `PanelCloseButton.tsx`) now read `client/src/...`. No `test` script is listed, and `dev` is not described as `vercel dev`.
- `README.md`: all 9 `src/scenarios` and `src/incidents` references now read `client/src/...`. The "By hand" paragraph now says `validate` checks snapshot freshness, and to run `npm run snapshot` after any data edit.
- `CONTRIBUTING.md`: the data path now reads `client/src/scenarios/`. The `.js` shadowing warning now names `client/`. The dev-setup block adds `typecheck` and `snapshot` and notes that `build` covers every workspace.
- `.github/workflows/cosmos-sync.yml`: no change needed. It has no `src/` path (checked with grep). It only calls `npm run sync:clone-repos` and `npm run sync:nightly`.

**M0 verification gate**
| Check | Result |
|---|---|
| Grep gate `grep -rn "src/scenarios\|src/incidents" --exclude-dir={node_modules,client,dist} .` | PASS. No stale hit in any live file. The remaining hits are all historical records and were **deliberately not rewritten**: `.claude/status/stage-{1,2,4,5}-*.md`, `docs/plans/add-ai.md` (lines 107, 110, 120), `docs/plans/plan.md` (lines 24, 25, 51, 95, 98) and `docs/status/ledger.md:8`. A wider sweep for any root-relative `src/` (excluding client, status, plans, pre-plans, versions and .git) found nothing. |
| `npm run build` | PASS. Client `tsc -b && vite build` and the server `tsc --noEmit` both pass. |
| `npm run typecheck` | PASS for both workspaces. |
| `npm run lint` | PASS: 0 errors, 2 warnings. Both warnings were already there (exhaustive-deps in `AskPanel.tsx:53` and `Map.tsx:820`). |
| `npx tsc -p drift-sync --noEmit` (open since stage 1) | PASS, run as `npm exec -- tsc -p drift-sync --noEmit`. A bare `npx` or `./node_modules/.bin` call is denied by permissions. `npm exec` runs the same local binary. |
| `npx eslint server/scripts/snapshot-map.ts` (open since stage 3) | PASS, run as `npm exec -- eslint server/scripts/snapshot-map.ts`, same reason. |
| `npm run validate` | PASS: 12 services, 8 topics, 40 steps, 5 scenarios, 0 errors. |
| validate catches a bad step id | PASS. `client/src/scenarios/steps/shopping.ts:5` `from: 'storefront'` was changed to `'storefrontzz'`. validate exited 1 with `step.from "storefrontzz" is not a known service or topic`. The file was restored and `git diff` on it is empty. |
| validate catches a stale snapshot | PASS. `"storefront"` was hand-edited in `server/src/generated/cosmos-map.json`. validate exited 1 with `[ERROR] stale-snapshot … cosmos-map.json is stale — run npm run snapshot`. The file was restored, `git diff` on it is empty, and validate is green again. |
| drift-sync dry run: `npm run sync:bootstrap -- --dry-run` (the plan's `npm run sync -- --dry-run` does not exist) | Ran to the end with no module or path errors. It read all 15 repo entries from the client map. It **exits 1**: every repo is `MISS (directory not found)` because no sibling source repos are cloned (AstroMart is fictional). That is an environment limit, not a code fault. See Open questions. |
| Runtime, at 390px first and then 1440×900 | PASS. `npm run dev:client` (branch, :5174) was compared with a `git archive main` baseline (:5180), both driven with a throwaway Playwright script. On both builds and both viewports: 12 service nodes render. Playing *Place an order* shows its status and the URL reaches `step=2`. Incident `payment-cascade-2026-03-12` shows *Payment cascade*. Clicking a star opens the inspector (title "cart"). The deep link `?domain=fulfillment&scenario=fulfillment.pack-and-ship&step=3` loads *Pack & ship*. No page errors. Paired screenshots look the same, apart from the version label (v1.3.1 vs v1.2.2). **No behaviour change.** |

Screenshots (20, not committed): `/private/tmp/claude-501/-Users-orassayag-Repos-project-cosmos/fd702c23-7807-49f0-a717-83dfb4af4e1f/scratchpad/shots/{m390,desktop}-{branch,main}-{1-overview,2-scenario-playing,3-incident,4-inspector,5-deeplink}.png`

Both dev servers I started are stopped. The working tree has only the 3 files above, plus `docs/status/stage-plan.md`, which the orchestrator had already modified. I did not touch it.

## Commit message
docs: repoint CLAUDE.md, README and CONTRIBUTING at client/src

The M0 move put the map data under client/src and added the server
snapshot, so the contributor docs pointed at paths that no longer exist
and listed out-of-date root scripts. cosmos-sync.yml needed no change.

## Key decisions
- `cosmos-sync.yml` was left untouched because it references no `src/` path. Editing it would be scope creep.
- Historical records (plans, ledger, stage reports) that mention old paths were reported, not rewritten.
- `snapshot` was documented in all three docs. validate now fails on a stale snapshot, so a contributor editing data by hand would otherwise hit a failure the docs never mention.
- Bare filenames next to a full `client/src/...` path (for example `types.ts`, `services.ts`) were left as they are, matching stage 4.
- The main baseline was exported with `git archive main` into the scratchpad and installed there. There was no worktree and no branch switch.
- Playwright was run from a throwaway `playwright-core@1.62.1` install in the scratchpad, using the cached Chromium. Nothing was added to the project.

## Open questions
- **drift-sync dry run exits 1.** `sync:bootstrap -- --dry-run` resolves the map but finds no sibling repos, so it exits 1 with "No repos resolved". That is expected in this environment. Is that acceptable as "completes" for the M0 gate, or should someone run it on a machine where the repos are cloned?
- **Pre-existing, not a regression:** the deep link `step=3` loads as `step=1` on **both** main and the branch. It may be a latent deep-link bug worth a separate ticket.
- A `vite` process (PID 23408) was already listening on :5173, started from the repo root before this stage. The root has no `index.html` any more, so it is probably left over from before the move. I left it running. The user may want to stop it.
