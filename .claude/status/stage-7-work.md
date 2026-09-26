# Stage 7 work brief — Vitest harness in client + server, root test fan-out, CI npm test step

Stage-plan line: `Stage 7: PLANNED — Vitest harness in client + server, root test fan-out, CI npm test step`

## Scope (files this stage owns)
- `client/package.json` — add devDeps `vitest`, `@testing-library/react`, `@testing-library/jest-dom` (if used), `jsdom`; add a `test` script (`vitest run`).
- `client/vitest.config.ts` (or a `test` block in `client/vite.config.ts` — pick whichever keeps the app build untouched and type-checks cleanly under `tsc -b`) — `environment: 'jsdom'`, include `src/**/__tests__/**/*.test.{ts,tsx}`.
- `server/package.json` — add devDep `vitest`; add a `test` script (`vitest run`). Node environment.
- `server/vitest.config.ts` only if needed (include `src/**/__tests__/**/*.test.ts`).
- Root `package.json` — `"test": "npm run test --workspaces"`. **Never `--if-present`** on a gate script (plan §1): every workspace must have a real `test` script.
- `.github/workflows/validate-on-pr.yml` — add a `Test` step running `npm test` (after Lint/Build, before or after Validate — keep it before Validate). Update the header comment that lists what runs, if it names the steps.
- One harness-proof test per workspace, so `vitest run` never exits on "no test files" and the harness is proven live, not vacuous. **Do not use `passWithNoTests`** (same reasoning as never using `--if-present`). Keep each tiny and genuinely useful, e.g.:
  - `server/src/__tests__/cosmosMap.test.ts`: the committed `src/generated/cosmos-map.json` loads and has non-empty services/scenarios with unique ids.
  - `client/src/components/__tests__/<something>.test.tsx`: one small RTL render of an existing leaf component (proves jsdom + React + RTL are wired), OR a pure data test on `client/src/scenarios` — prefer the RTL render since stage 8+ rely on RTL working.
- `package-lock.json` — will change from the installs; list it in `## Files`.
- `.gitignore` — only if a Vitest artefact (e.g. `coverage/`) needs ignoring.

Test file locations follow the convention: `<subject>.test.ts(x)` in a `__tests__/` folder beside the subject.

**Type-check / lint interplay (must stay green):**
- `client` `build` is `tsc -b && vite build`; test files under `client/src` are included by the client tsconfig. Make sure test files type-check (Vitest types, jest-dom matchers if used) and that test-only code/deps do not get bundled into `vite build`. If including tests in `tsc -b` is a problem, exclude them from the app tsconfig and type-check them some other way — do not leave them unchecked silently; say what you chose.
- `server` `typecheck` is `tsc -p . --noEmit && tsc -p scripts --noEmit` — test files must pass it.
- `npm run lint` runs root `eslint .` — tests must lint clean. Prefer explicit `import { describe, it, expect } from 'vitest'` over globals so no eslint/tsconfig globals config is needed.
- Engines: root `engines.node` is `>=20`, CI uses Node 22. Pick Vitest/jsdom versions that run on Node 22. Do not change `engines` here (stage 11 owns that per plan §3).

Out of scope: any of the plan's named feature tests (`AskAgent.test`, `cookieCrypto.test`, …) — those land in stages 8+ with their subjects. No server app code. Don't touch `client/vite.config.ts` `BASE_PATH` (stale comment noted in stage 6 ledger — leave it). Don't switch root `dev`.

## Related plan excerpts (verbatim)

Scope: "A Vitest test harness in both workspaces, run in CI."

Issue resolution I11: "\"Test it\" has nowhere to run | Fixed | Vitest in both workspaces, wired into CI. Tests are named per task below."

Design intro: "Delivery runs in four milestones. Each one ends demonstrable and green on `npm run build`, `npm run lint`, `npm test`, and `npm run validate` before the next starts."

§1 path consumers:
- "`.github/workflows/validate-on-pr.yml`: add the `npm test` step. Commands keep running from root through workspace scripts."
- "Root `package.json`: `dev` runs `vercel dev` (both services). `dev:client` keeps plain Vite on :5173. `build`, `lint`, `typecheck`, and `test` fan out with `--workspaces`. `validate` is **not** fanned out: it stays the root script `tsx drift-sync/scripts/validate.ts` (repointed at `client/src/scenarios`), and the snapshot-freshness check lives inside it. No workspace has a `validate` script, so fanning it out would either fail or, with `--if-present`, silently run nothing. **Never use `--if-present` on a gate script.** Dependencies move into the workspace that uses them."

§3 Tests: "`server/src/__tests__/`, Vitest, unit layer"

§4 Tests: "Vitest + React Testing Library + jsdom in `client/`, under `client/src/components/__tests__/`" — `ConnectAgentModal.test.tsx` will later render inside `OverlayProvider` with "the phone viewport mocked", so the jsdom setup should allow mocking `window.matchMedia` per test (a setup file stubbing `matchMedia` is welcome if an existing hook like `useViewport` needs it to render).

Final acceptance: "`/test` passes: type-check (`tsc -b` in client, `tsc --noEmit` in server and drift-sync), lint, `npm test` in both workspaces, build, and `npm run validate`".

## Verification expected in the report
- `npm test` from root: runs both workspaces, both pass (paste counts, not output).
- Prove non-vacuous: temporarily break one assertion in each workspace, confirm `npm test` exits non-zero, revert.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run validate` all pass.
- Confirm `client/dist` contains no test code / testing-library strings after `vite build`.
- `validate-on-pr.yml` parses as YAML and shows the new step.
