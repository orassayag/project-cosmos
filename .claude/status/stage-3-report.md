# Stage 3 report — §3: useAiConnection `enabled` + useDemoAiConnection

## Files
client/src/hooks/useAiConnection.ts
client/src/hooks/__tests__/useAiConnection.test.ts
client/src/demo/useDemoAiConnection.ts
client/src/demo/__tests__/useDemoAiConnection.test.ts

## Summary
`useAiConnection` now takes `{ enabled }` (default `true`). While it is `false`, the hook skips the `/api/ai/status` fetch and reports `disconnected` with no provider. Setting it back to `true` runs the status check again. The new `useDemoAiConnection()` returns an `AiConnection`-compatible fake, with `isConnecting` and `setDemoStatus` added. The runner moves it through `disconnected → connecting → connected`, its provider is always `anthropic`, and its `connect`/`disconnect` never touch the network. Results: `npm --prefix client test` passed (10 files, 75 tests). `npm run typecheck` is clean. `npm run lint` has 0 errors; its one warning is an existing one in `client/src/map/Map.tsx:814`, not in any file this stage touched.

## Commit message
feat(demo): add fake AI connection and disable switch for real one

The demo must never call /api/ai/* or spend a visitor's real key (I5).
useAiConnection gains an `enabled` option that skips the status check,
and useDemoAiConnection is a runner-driven, network-free stand-in with
the same AiConnection shape so App can swap between the two.

## Key decisions
- **Mapping from `DemoAiStatus` to the `AiConnection` fields** (for stages 4 and 8):
  | DemoAiStatus | `status` | `provider` | `isConnecting` |
  |---|---|---|---|
  | `disconnected` | `disconnected` | `null` | `false` |
  | `connecting` | `disconnected` | `null` | `true` |
  | `connected` | `connected` | `anthropic` | `false` |
  `AiConnectionStatus` has no in-between state, so while the demo is connecting it still reports `disconnected`. The busy state shows up only in the separate `isConnecting` flag.
- **Stage 4:** `ConnectAgentModal` keeps `isBusy` as its own internal `useState` today. It needs a new prop (for example `isBusyOverride` / `isDemoBusy`) so that App can pass `demoAi.isConnecting` to it.
- **Stage 8 wiring:** App calls both hooks every render, as the rules of hooks require: `const realAi = useAiConnection({ enabled: !isDemoActive })` and `const demoAi = useDemoAiConnection()`. It passes `isDemoActive ? demoAi : realAi` down. The `DemoActions.setAiStatus` given to the runner is `demoAi.setDemoStatus`, which is a stable `useState` setter and safe to use in dependency arrays. When the demo ends or is aborted, stage 8 should call `demoAi.setDemoStatus('disconnected')` and set `isDemoActive` to false. Turning `enabled` back on makes `realAi` re-check `/api/ai/status`, and a test covers this.
- **Stale status after re-enabling:** while disabled, the real hook overrides only its return value and leaves its internal state alone. When it is enabled again, it shows its last known status until the new check comes back. That value is `unknown` if the demo started on page load.
- `useDemoAiConnection().connect` ignores the provider and key it is passed and always reports `anthropic`, because the plan fixes the demo provider. `DEMO_AI_PROVIDER` is exported for tests and scripts.

## Open questions
- The plan's "runner test asserts `fetch` is never called during a full `ai` script" is deferred to stage 7, because it needs that stage's `demo=ai` script. For now, this stage's tests check that no `fetch` happens when the runner drives the hook through a `connect` step, and during direct `connect`/`disconnect` calls.
