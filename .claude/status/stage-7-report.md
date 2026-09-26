# Stage 7 report: Vitest harness in client + server, root test fan-out, CI npm test step

## Files
package.json
package-lock.json
client/package.json
client/vitest.config.ts
client/src/testing/vitestSetup.ts
client/src/components/__tests__/PanelCloseButton.test.tsx
server/package.json
server/src/__tests__/cosmosMap.test.ts
.github/workflows/validate-on-pr.yml

The stage touched 9 files. The ceiling is 6. The brief expected package-lock.json and the two test files on top, which gives 9. The extra file beyond those is `client/src/testing/vitestSetup.ts`, which RTL cleanup needs (see Key decisions).

## Summary
**Edits**
- **`client/package.json`:**
  - New devDeps: `vitest@^5.0.2`, `jsdom@^30.1.1`, `@testing-library/react@^16.3.3`, `@testing-library/dom@^10.4.2`. `@testing-library/dom` is RTL 16's required peer.
  - New script: `"test": "vitest run"`.
- **`client/vitest.config.ts` (new):** it runs `mergeConfig` over `./vite.config.ts`, so tests get the same React plugin and `__APP_VERSION__` define. It sets `environment: 'jsdom'`, `include: ['src/**/__tests__/**/*.test.{ts,tsx}']` and `setupFiles: ['src/testing/vitestSetup.ts']`. `client/vite.config.ts` is untouched, including `BASE_PATH`.
- **`client/src/testing/vitestSetup.ts` (new):** it calls `afterEach(cleanup)`. RTL only registers its own unmount hook when Vitest globals are on, and they are off.
- **`client/src/components/__tests__/PanelCloseButton.test.tsx` (new):** an RTL render of the mobile close-button leaf component. The test finds the button by its accessible name, clicks it, and asserts that `onClose` fires once and the click does not bubble to the parent (`stopPropagation`).
- **`server/package.json`:** new devDep `vitest@^5.0.2` and new script `"test": "vitest run"`. There is no server vitest config: the default Node environment and default include pattern already find `src/__tests__/*.test.ts`.
- **`server/src/__tests__/cosmosMap.test.ts` (new):** imports the committed `src/generated/cosmos-map.json` (`with { type: 'json' }`, which NodeNext accepts). It asserts that services and scenarios are both non-empty and have no duplicate ids.
- **Root `package.json`:** `"test": "npm run test --workspaces"`. There is no `--if-present` and no `passWithNoTests`.
- **`.github/workflows/validate-on-pr.yml`:** a new `Test` step (`npm test`) runs after Typecheck drift-sync and before Validate. The header comment now lists lint + typecheck + build + `npm test` + validate.

**Verification**
| Check | Result |
|---|---|
| `npm test` (root) | PASS. client: 1 file, 1 test. server: 1 file, 2 tests. |
| Non-vacuous: client assertion broken (`toHaveBeenCalledTimes(2)`) | `npm test` exited 1. Reverted. |
| Non-vacuous: server assertion broken (`toEqual(["x"])`) | `npm test` exited 1, with 2 server tests failing. Reverted. |
| `npm test` after the reverts | Both pass, exit 0 |
| `npm run build` | PASS (client `tsc -b && vite build`, server) |
| `npm run typecheck` | PASS (both workspaces) |
| `npm run lint` | PASS: 0 errors. The 2 warnings are the known pre-existing exhaustive-deps ones in AskPanel.tsx and Map.tsx. |
| `npm run validate` | PASS: 0 errors, no drift |
| `npm exec -- tsc -p drift-sync --noEmit` | PASS |
| Test files are type-checked | `tsc -p client --listFilesOnly` includes `PanelCloseButton.test.tsx` and `testing/vitestSetup.ts`. The server test is covered by `src/**/*.ts` in `server/tsconfig.json`. |
| `client/vitest.config.ts` type-checks | PASS with a standalone `tsc --noEmit`. It sits outside every tsconfig `include`, the same as `vite.config.ts`. |
| `client/dist` leak check | `grep -rlE "testing-library\|vitest\|PanelCloseButton\.test" client/dist` finds nothing |
| `validate-on-pr.yml` YAML | Parses. The steps are Checkout, Setup Node, Install deps, Lint, Build, Typecheck drift-sync, **Test**, Validate. |

## Commit message
test: add Vitest harness to client and server, run it in CI

Later stages ship tests alongside their features and need somewhere to
run them. Each workspace now has a real `vitest run` script, and CI runs
`npm test` before validate.

## Key decisions
- **Test files stay inside the app tsconfig.** `tsc -b` checks them through `include: ["src"]`, and they import `vitest` and RTL explicitly, so no global types are needed. `vite build` only bundles what `index.html` reaches, so tests never reach `dist`. I confirmed this with the grep above.
- **No `@testing-library/jest-dom`.** Plain `expect` assertions are enough for now, and leaving it out avoids adding global matcher type augmentation to the app tsconfig. A later stage can add it if it needs DOM matchers.
- **No `matchMedia` stub in setup.** `useViewport` already guards against a missing `matchMedia`, and so do `Map.tsx` and `BrandStarfield.tsx`, so nothing needs the stub to render. A test that mocks the phone viewport (the stage 8+ `ConnectAgentModal` test) can use `vi.stubGlobal('matchMedia', …)` for itself.
- **Separate `client/vitest.config.ts` merged over `vite.config.ts`, not a `test` block in `vite.config.ts`.** This leaves the app build config byte-identical. It imports `./vite.config.ts` with the extension, which silences Vite's native-config-loader warning.
- **Versions.** Vitest 5.0.2 accepts Vite `^8`. jsdom 30.1.1 needs Node `^22.22.2 || ^24.15 || >=26`. RTL 16.3.3 accepts React 19. CI's Node `'22'` resolves to the latest 22.x, which satisfies jsdom, and local Node is 26.9. Root `engines: >=20` is now looser than what the client test toolchain needs. I left it unchanged, as the brief says, because stage 11 owns `engines`.
- **No `.gitignore` change.** `coverage/` is already ignored.
