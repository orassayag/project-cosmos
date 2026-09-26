# Stage 8 report — M1: shared .lc-status-dot, useAiConnection, AskAgent Search/bot light/Connect-Disconnect

## Files
client/src/hooks/useAiConnection.ts
client/src/components/AskAgent.tsx
client/src/components/__tests__/AskAgent.test.tsx
client/src/components/DriftFooter.tsx
client/src/styles/app.css
client/src/App.tsx

## Summary
- `.lc-drift-footer-dot` extracted into shared `.lc-status-dot` (7px round) with modifiers `--on` (`--svc-green` + glow + 2.6s pulse, keyframes renamed `lc-status-pulse`), `--off` (`--svc-red`, no pulse), `--unknown` (`--text-faint` grey). `DriftFooter` now renders `lc-status-dot lc-status-dot--on`; no references to the old class/keyframe remain. Computed drift dot colour verified unchanged (`oklch(0.8 0.13 158)`).
- New `useAiConnection` hook: `GET /api/ai/status` once on mount (AbortController on unmount), exposes `{ status: 'unknown'|'connected'|'disconnected', provider, connect(provider, apiKey), disconnect() }`. Any rejected fetch, non-OK response (404 today, 503 `AI_NOT_CONFIGURED`), unparseable body or `connected !== true` resolves to `disconnected` — no throw, no console output, single call.
- `AskAgent`: "Go!" → **Search** (`title="Search"`); 🤖 + status dot on the right of the input (tooltip + `aria-label`: "AI agent connected (Claude)" / "No AI agent connected" / "Checking for an AI agent" while unknown); expanded footer shows **Connect AI Agent** (disconnected) or **Disconnect AI Agent** (connected) left of Search, both `onMouseDown` + `preventDefault`. New props: `aiStatus`, `aiProvider`, `onConnectRequest`, `onDisconnect`.
- `App.tsx`: calls `useAiConnection()` in the app body, passes status/provider to AskAgent; `onDisconnect` → `disconnect()`; `onConnectRequest` is an empty callback for stage 9 to replace with `overlay.open(OVERLAY.connect)`.
- Gates: `npm run build` pass, `npm run typecheck` pass, `npm run lint` pass (0 errors, the 2 pre-existing exhaustive-deps warnings in AskPanel.tsx/Map.tsx only), `npm test` pass (client 5/5 incl. 4 new AskAgent tests; server 2/2), `npm run validate` pass (no drift).
- Non-vacuous proof: temporarily mapped `connected → 'off'` and restored "Go!" in AskAgent → 2 tests failed ("Search" label, connected light); reverted → 5/5 pass.
- Visual/runtime check (Playwright, scratchpad install, client Vite on :5188): phone 390×844 FIRST, then landscape 844×390, then desktop 1440×900, each disconnected (real 404 from dev server) and connected (status route mocked `{connected:true, provider:'anthropic'}`). No page errors; no horizontal page scroll; footer does not overflow (shell 359px at 390 wide); bot + dot centred in the collapsed pill and top-right in the expanded card; correct button/dot/label per state in all six runs.

## Commit message
feat(client): add AI connection light and Connect/Disconnect to AskAgent

The ask bar needs to show whether a real AI agent backs its answers and give
visitors a way to connect one. The status hook treats any failed status call as
disconnected so the client keeps working before the /api/ai routes exist.

## Key decisions
- **`connect()` result shape:** `Promise<ConnectResult>` where `ConnectResult = { ok: true; provider } | { ok: false; errorCode: 'INVALID_KEY' | 'AI_NOT_CONFIGURED' | 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE' }`. It never throws; status/provider update only on success. Stage 9's modal shows its error on `ok: false` and stays open.
- **`disconnect()`** returns `Promise<boolean>` and never throws; the light flips to disconnected only when the server confirms (the cookie is httpOnly, so the server is the truth).
- **Hook lives in App, AskAgent is presentational** (props, not the hook) — stage 9's modal, rendered in App, needs the same `connect()`, and the component test needs no fetch mocking.
- **`unknown` state:** grey dot and neither Connect nor Disconnect button (avoids offering the wrong action for the brief load window). Tooltip "Checking for an AI agent" — the plan specified only the two settled strings.
- Provider display labels (`AI_PROVIDER_LABELS`: anthropic → "Claude", openai → "OpenAI") exported from the hook module.
- Connect button blurs the field (collapses the card) before calling `onConnectRequest`, since a modal will take over; Disconnect keeps the card open so the label visibly flips.
- Bot vertical centring uses `top:50%/translateY` while collapsed so it centres in both the 30px desktop pill and the 34px mobile pill without a `responsive.css` entry.

## Open questions
- No unit test for `useAiConnection` itself (404/503 → disconnected, connect error mapping) — it would be a 7th file over the stage ceiling. Behaviour was verified at runtime against the real 404; stage 9 or 12 could add `client/src/hooks/__tests__/useAiConnection.test.ts`.
