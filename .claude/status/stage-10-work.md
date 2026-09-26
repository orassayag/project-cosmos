# Stage 10 work brief — M1: AskPanel connect prompt under joke answers + starter question chips

Plan: `docs/plans/add-ai.md` (§4 — Milestone 1: Client UI). No spec file for this run.

## Stage scope (from the stage plan)
- Stage 10: M1: AskPanel connect prompt under joke answers + starter question chips

## Plan sections (pasted verbatim from §4)

> **Disconnected behaviour:** `AskPanel` keeps `DEMO_ANSWERS`, with one extra line under the joke: "Connect an AI agent for real answers." That line is a button that opens the modal.
>
> **Starter chips (A3):** when the expanded field is empty, show 2–3 clickable example questions ("What happens when a payment fails?", "Which team owns checkout?", "Play the order flow"). Clicking one fills the field and submits.

Related §4 context (already built — do not redo):

> **New `client/src/components/ConnectAgentModal.tsx`** … **Overlay registration:** add `connect: 'connect-agent'` to `OVERLAY` in `client/src/overlays/OverlayManager.tsx`. The modal's visibility is `overlay.isOpen(OVERLAY.connect)`, and every open/close goes through `overlay.open` / `overlay.close` — no private `open` boolean. So on desktop opening it closes whatever was open, and on phones it stacks and closing it brings back the buried panel (e.g. the answer panel) intact.

> Visual: drive with `browser-drive` at 390×844 and 844×390, then desktop 1440×900.

Scope item from the plan's Scope list: "Streaming answers, starter question chips, and a per-answer token count (round-1 additions A1–A4, accepted)." — only the **starter chips** belong to this stage; streaming and token count are stages 17/19.

## Stage-specific notes for the worker
- The connect prompt appears **only when disconnected** (the joke/`DEMO_ANSWERS` path). The AI connection state comes from the single `useAiConnection()` instance in `App.tsx` (stage 8) — do not create a second instance.
- Opening the modal: `overlay.open(OVERLAY.connect)` via `useOverlay()` — `ConnectAgentModal` needs no props or state (stage 9 ledger).
- Starter chips live in the **expanded AskAgent field while it is empty**; clicking one fills the field and submits via the existing submit path. Use `onMouseDown` + `preventDefault` like the existing footer buttons so the card doesn't collapse first.
- Mobile-first: lay out and verify at 390×844 and 844×390 before 1440×900. Chips must wrap, never cause horizontal scroll; tap targets ≥ 40px tall on touch.
- No new panel is introduced, so the mobile close-button / one-card-at-a-time contracts are unaffected — confirm that nothing stacks.
- Tests: add coverage (in `client/src/components/__tests__/`) that (a) the connect prompt shows under a joke answer when disconnected, is absent when connected, and clicking it makes `OVERLAY.connect` active; (b) chips show only when the field is empty and clicking one submits that question.
