# Stage 9 work brief — M1: ConnectAgentModal + OVERLAY.connect registration + responsive.css priority + ConnectAgentModal.test

Stage-plan line: M1: ConnectAgentModal + OVERLAY.connect registration + responsive.css priority + ConnectAgentModal.test
Ceilings: ≤6 files, ≤250 hand-written LOC.

## In scope (pasted from docs/plans/add-ai.md §4)

**New `client/src/components/ConnectAgentModal.tsx`**
- A provider picker (Claude / OpenAI segmented control) and a key field (`type="password"`, `autoComplete="off"`).
- A "Get a key" link per provider (`https://console.anthropic.com/settings/keys` or `https://platform.openai.com/api-keys`).
- A Connect button with a busy state, and inline errors ("That key didn't work — check it and try again").
- It closes on success. One provider at a time: connecting a second provider replaces the first, and the modal says so.
- **Overlay registration:** add `connect: 'connect-agent'` to `OVERLAY` in `client/src/overlays/OverlayManager.tsx`. The modal's visibility is `overlay.isOpen(OVERLAY.connect)`, and every open/close goes through `overlay.open` / `overlay.close` — no private `open` boolean. So on desktop opening it closes whatever was open, and on phones it stacks and closing it brings back the buried panel (e.g. the answer panel) intact.
- **Mobile contract:** it has its own top-right header close button. It also joins the "One card at a time" block in `client/src/styles/responsive.css` (kept alongside the manager registration), so it hides the context panels on phone-class viewports. It is laid out at 390px first and in short landscape (`max-height:480px`).

Relevant disconnected-status rule (§2): the client treats `AI_NOT_CONFIGURED` from `status` as disconnected and hides the Connect button.

**Wiring:** replace the empty `onConnectRequest` callback in `client/src/App.tsx` (left by stage 8) with `overlay.open(OVERLAY.connect)`, render `<ConnectAgentModal>` in App using the same `useAiConnection()` instance's `connect()` (result shape `ConnectResult` from stage 8 — show the error on `ok:false`, keep modal open; close via `overlay.close` on success). Map `errorCode` to plain inline messages (INVALID_KEY → "That key didn't work — check it and try again"; others get a sensible plain message).

## Tests (pasted from §4)

  - `ConnectAgentModal.test.tsx`: a failed connect shows the inline error and keeps the modal open; success closes it. Rendered inside `OverlayProvider`: opening it from the open answer panel makes `OVERLAY.connect` active; with the phone viewport mocked, closing it makes `OVERLAY.ask` active again. *Protects: a visitor always knows whether their key was accepted, and the modal never stacks on or loses another panel (round-2 I5).*
- Visual: drive with `browser-drive` at 390×844 and 844×390, then desktop 1440×900. Screenshot the modal over an open answer panel on a phone to prove no stacking, and confirm the close button is visible.

## Out of scope (later stages)
- AskPanel "Connect an AI agent for real answers." line + starter chips → stage 10.
- Server routes → stages 11–12. `/api/ai/*` 404s locally today; mock the status/connect route for runtime checks.
- Optional: `client/src/hooks/__tests__/useAiConnection.test.ts` (stage-8 open question) ONLY if it fits within the 6-file / 250-LOC ceiling; otherwise leave it and note it.

## Project rules to honour
- Mobile-first: build/verify at 390×844 and 844×390 first, then 1440×900. One panel at a time; modal has its own top-right header close button; join the "One card at a time" block in client/src/styles/responsive.css.
- Never run `tsc` without `--noEmit`/`-b`. Use `npm exec -- <bin>` (bare npx is permission-denied). A stale vite may be on :5173 — use another port for runtime checks; install Playwright in the scratchpad, not the repo.
