# Stage 4 report — §4: ConnectAgentModal `demo` prop

## Files
client/src/components/ConnectAgentModal.tsx
client/src/components/__tests__/ConnectAgentModal.test.tsx
client/src/demo/types.ts

## Summary
`ConnectAgentModal` takes a new optional `demo?: DemoConnectState` prop (`{ provider, providerKey, jevKey, showJevField, isBusy }`, defined in `demo/types.ts`). When `demo` is present, the dialog takes its provider, key value, and busy state from the prop. The key inputs are read-only, and clicking a provider button does nothing. When `showJevField` is true, a second password `lc-connect-field` labelled "Vercel AI Gateway key (JEV, site owner)" appears below the provider key. Submitting the form never calls `onConnect`. When `demo` is absent, the dialog works exactly as it did before, with no JEV field. The close button, Escape key, and overlay behaviour are unchanged. Three tests were added: in demo mode the JEV field and both masked values render and submit never calls `onConnect`; the busy state comes from `demo.isBusy`; without `demo` there is no JEV field. Results: `npm --prefix client test` passed (10 files, 78 tests). `npm run typecheck` is clean. `npm run lint` has 0 errors; its one warning is an existing one at `client/src/map/Map.tsx:814`, in a file this stage did not touch.

## Commit message
feat(demo): let the demo drive the Connect window with a JEV key field

The recorded demo must show both keys being pasted without ever submitting
a real key (I1). A `demo` prop makes the dialog fully controlled by the
runner and adds a site-owner-only JEV field that real visitors never see.

## Key decisions
- `DemoConnectState` lives in `client/src/demo/types.ts`, next to the other demo types. The modal imports it type-only.
- The internal state was renamed to `selectedProvider` / `typedKey` / `isSubmitting`. The values the dialog actually renders (`provider` / `apiKey` / `isBusy`) are computed as `demo?.x ?? internal`, so the non-demo code path is unchanged.
- In demo mode the inputs are `readOnly`. This avoids React's controlled-input warning and stops a stray click from changing the scripted values.
- When the key is non-empty, the submit button stays enabled in demo mode, so the fake pointer (stage 10) can "click" it. `handleSubmit` returns early, and the runner drives `connecting → connected` through §3.
- **For stage 8:** App should build the `demo` object from the runner's state: `provider` from `pickProvider`, `providerKey`/`jevKey` from `setConnectField` (both start as `''`), `showJevField` true for the demo script, and `isBusy: demoAi.isConnecting`. It passes `demo` only while the demo is active.
- The caption text is not rendered here; stage 9's caption bar shows it.
