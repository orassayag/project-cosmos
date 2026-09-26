# Stage 3 work brief — §3: useAiConnection `enabled` + useDemoAiConnection

Stage-plan line: `useAiConnection `enabled` option + test, demo/useDemoAiConnection.ts (runner-driven fake connection, no network)`

Files expected (≤6 files, ≤300 lines each):
- `client/src/hooks/useAiConnection.ts` (edit — add `enabled` option)
- `client/src/hooks/__tests__/useAiConnection.test.ts` (edit or create — add `enabled: false` case)
- `client/src/demo/useDemoAiConnection.ts` (new)
- `client/src/demo/__tests__/useDemoAiConnection.test.ts` (new)

Builds on stage 1's `client/src/demo/types.ts` (`DemoAiStatus`, `DemoActions.setAiStatus`) and stage 2's `runDemo.ts`. Read both first; do not redefine their types. Read `useAiConnection.ts` to reuse its exported `AiConnection` shape exactly — `useDemoAiConnection` must be assignable to it so App (stage 8) can pass `demo ? demoAi : realAi` down.

Out of scope for this stage: App.tsx wiring (stage 8), the `demo=ai` script table (stage 7). The plan's "runner test asserts `fetch` is never called during a full `ai` script" needs the stage-7 script — do not fake it here; note it under Open questions as deferred to stage 7.

## Plan — §3 Fake AI connection (I5) (verbatim)

- `useAiConnection({ enabled })` gets an `enabled` option, true by default. When it is false,
  the hook skips the `/api/ai/status` fetch and reports `disconnected`.
- `useDemoAiConnection()` in `client/src/demo/` returns the same `AiConnection` shape. Its
  status is driven by the runner (`disconnected → connecting → connected`) and its provider is
  `anthropic`. Its `connect`/`disconnect` never touch the network.
- App calls both hooks unconditionally, following the rules of hooks, and passes
  `demo ? demoAi : realAi` down. While the demo is active, `realAi` is created with
  `enabled: false`. After an abort, App switches back to `realAi`, which then re-checks status.
- Tests: `client/src/hooks/__tests__/useAiConnection.test.ts` adds that `enabled: false` makes
  no `fetch` call. *Protects: the demo never calls the AI server, for any visitor state.* The
  runner test asserts that `fetch` is never called during a full `ai` script. Unit layer.

## Plan — Issue I5 (verbatim)

| I5 | The demo breaks, or spends a real key, when the real AI status isn't "disconnected" | Claude (adversarial) | Fixed | A local fake connection replaces the real one, and the real hook is disabled. No `/api/ai/*` calls. Design §3. |

## Plan — §1 abort note relevant to this stage (verbatim excerpt)

- Abort (I8): `useDemoRunner` owns one `AbortController`. … On abort or on finish it hides the pointer and
  caption, drops the fake AI connection back to the real one (§3), …

Implications for this stage:
- "After an abort, App switches back to `realAi`, which then re-checks status" → flipping `enabled` from false to true must trigger the `/api/ai/status` check (e.g. effect keyed on `enabled`). Test it.
- The demo hook must expose a way for the runner's `DemoActions.setAiStatus(status: DemoAiStatus)` to drive it (stage 1 ledger: `DemoAiStatus` is separate from app `AiConnectionStatus`; stage 3 maps `connecting` → modal `isBusy`). Map `DemoAiStatus` onto whatever fields `AiConnection` exposes (status / busy flag / provider) and document the mapping in Key decisions for stages 4 and 8.
