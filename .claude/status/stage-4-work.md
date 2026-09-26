# Stage 4 work brief — §4: ConnectAgentModal `demo` prop

Stage plan line: **§4: ConnectAgentModal `demo` prop (controlled dialog, JEV "site owner" field, no onConnect) + ConnectAgentModal.test cases**

Expected files (≤ 6): `client/src/components/ConnectAgentModal.tsx`,
`client/src/components/__tests__/ConnectAgentModal.test.tsx`, and `client/src/demo/types.ts`
if `DemoConnectState` belongs there (it is a demo type — put it with the other demo types
unless a better existing home is obvious). Do not touch App.tsx (stage 8) or add
`data-demo-target` attributes (stage 10).

## Plan — §4 (pasted verbatim)

### §4 — Connect window with the JEV key (I1)

Per the developer, the JEV key is real. It is the site owner's Vercel AI Gateway key
(`AI_GATEWAY_API_KEY`), which JEV classification uses (`docs/plans/add-ai.md` §5). The video
shows both keys being pasted.

- `ConnectAgentModal` gets an optional `demo?: DemoConnectState` prop:
  `{ provider, providerKey, jevKey, showJevField, isBusy }`. When the prop is present:
  - The dialog is controlled by it: provider, the key value, and the busy state.
  - Below the provider key it renders a second `lc-connect-field` labelled **"Vercel AI Gateway
    key (JEV, site owner)"**, with the same password input style.
  - Submitting calls **no** `onConnect`. The runner drives `connecting → connected` through §3.
- When the prop is absent, the dialog behaves exactly as today. Visitors never see a JEV field,
  and in production the key stays a server environment variable.
- The pasted values are obvious fakes (`sk-ant-demo-••••••••`, `vck-demo-••••••••`). They
  appear all at once, like a paste, not one letter at a time.
- A caption on the paste step reads "Adding the JEV key (the site's question classifier)", so
  the video is honest about the key's role.
- Accepted gap: the video shows a field that real visitors don't have. The developer accepted
  this; the "site owner" label and the caption make the key's role clear.
- Tests: `client/src/components/__tests__/ConnectAgentModal.test.tsx` adds two cases. With
  `demo`, the JEV field (labelled "site owner") and both masked values render, and submitting never calls `onConnect`.
  Without `demo`, there is no JEV field. *Protects: the demo field never leaks to real visitors,
  and the demo never submits a key.* Component layer.

## Plan — §10 (relevant constraints)

The demo is **recorded on desktop (1920×1080) and must not break on phones.** It is built and
checked at 390px first, per the mobile-first invariant:
- The Connect window and the answer panel never show at the same time. The overlay manager
  already stacks them, and closing the Connect window restores the answer panel.

## Carry-forward notes from the ledger

- Stage 3: `ConnectAgentModal` keeps `isBusy` as internal `useState` today. The `demo.isBusy`
  field is how App (stage 8) will pass `demoAi.isConnecting`. When `demo` is present, the
  dialog's busy state comes from `demo.isBusy`, not internal state.
- The caption text is shown by the stage-9 caption bar, driven by the script's step caption —
  **not** rendered by the modal. Nothing to do for the caption in this stage.
- The existing modal's close button contract (mobile top-right close) must keep working.

No spec file for this run.
