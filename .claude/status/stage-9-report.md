# Stage 9 report — M1: ConnectAgentModal

## Files
client/src/components/ConnectAgentModal.tsx
client/src/components/__tests__/ConnectAgentModal.test.tsx
client/src/overlays/OverlayManager.tsx
client/src/App.tsx
client/src/styles/app.css
client/src/styles/responsive.css

## Summary
Visitors can now connect their own AI key. The **Connect AI Agent** button in the search card opens a "Connect an AI agent" modal. It has:
- a Claude / OpenAI segmented picker (`role="radiogroup"`)
- a password key field (`type="password"`, `autoComplete="off"`, 16px font so iOS does not zoom)
- a "Get a key" link for each provider (the Anthropic console or the OpenAI api-keys page)
- a Connect button that shows "Connecting…" and disables the form while busy
- a plain inline error when the connect fails. The modal stays open on failure and closes when the key is accepted.

When a provider is already connected, a note says the new key replaces it (one provider at a time).

- **Overlay:** `OVERLAY.connect = 'connect-agent'`. The modal is visible only while `overlay.isOpen(OVERLAY.connect)` is true, and it opens and closes only through the manager. There is no private boolean.
- **Mobile contract:** the modal has its own top-right close button (`.lc-help-close`). It also joins the "One card at a time" block in `responsive.css`, where it now has the highest priority and hides the inspector, ask, health, step, incident and legend panels.
- **Wiring:** `App.tsx`'s `onConnectRequest` now calls `overlay.open(OVERLAY.connect)`. `<ConnectAgentModal>` receives `aiConnection.provider` and `aiConnection.connect` from the same `useAiConnection()` instance, so the AskAgent light turns green on success.

**Gates:**

| Check | Result |
|---|---|
| `npm run typecheck` | green |
| `npm run build` | green |
| `npm run validate` | 0 errors, no drift |
| `npm test` | client 8/8 (3 new), server 2/2 |
| `npm run lint` | 0 errors; only the 2 known exhaustive-deps warnings in AskPanel.tsx and Map.tsx |

**Visual / runtime check:** I drove the app with scratchpad Playwright on a separate Vite server (:5291), mocking `/api/ai/status` and `/api/ai/connect` (first call 401 INVALID_KEY, second call 200). Viewports were 390×844 and 844×390 first, then 1440×900. At every size:
- the answer panel was hidden while the modal was up
- the close button sat inside the viewport, top-right of the dialog
- the error read "That key didn't work — check it and try again"
- the link switched with the provider
- a successful connect closed the modal and turned the status dot green
- there were no page errors

On both phone sizes, closing the modal brought the answer panel back intact. On desktop, opening the modal closed the answer panel, as the single-slot design intends. In short landscape the dialog is 331px tall inside a 390px viewport and fits without scrolling.

## Commit message
feat(client): add Connect AI agent modal behind the overlay manager

Visitors need a way to hand over their own Claude/OpenAI key and see
right away whether it was accepted. The modal is registered as
OVERLAY.connect, so it never stacks on or loses another panel.

## Key decisions
- **Self-contained visibility:** `ConnectAgentModal` reads `useOverlay()` itself and takes only `currentProvider` and `onConnect`. Stage 10 (the AskPanel connect prompt) opens it with `overlay.open(OVERLAY.connect)` and needs no props or state. On phones the answer panel is buried under the modal and comes back when the modal closes.
- **Portal:** the modal is portaled to `<body>`, so its one-card rule is `body:has(.lc-connect-overlay) .lc-stage :is(...)`, not `.lc-stage:has(...)`.
- **Shared help-modal styles:** it reuses the help modal's shell classes (`lc-help-overlay lc-help-modal lc-help-close`). Because of that, App's global Esc "reset galaxy" guard already skips while the modal is open; its own Esc handler closes it. The Esc guard selector did not need changing.
- **Error messages (`errorCode` → text):**
  - `INVALID_KEY` → "That key didn't work — check it and try again"
  - `AI_NOT_CONFIGURED` → "AI answers aren't available on this site right now."
  - `NETWORK_ERROR` → a message to check the connection
  - `UNEXPECTED_RESPONSE` → a generic "try again"
- **Key handling:** the key is trimmed before sending. The dialog's state unmounts on close, so a typed key never persists after the modal closes.
- **Closing while busy:** backdrop click, Esc and × are ignored while a connect is in flight.

## Open questions
- **Size ceiling exceeded:** 6 files (at the limit), but about 325 hand-written lines against the 250-line ceiling: component 155, test 73, CSS 82 + 8, App/manager 7. The main cause is the modal's styling block in `app.css`. Should it be trimmed or accepted as is?
- **Deferred test:** the optional `useAiConnection` unit test was not added, because the stage was already at the 6-file limit. It is still open for stage 12.
