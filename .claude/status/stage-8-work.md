# Stage 8 work brief — M1: shared .lc-status-dot, useAiConnection hook, AskAgent (Search, bot light, Connect/Disconnect) + AskAgent.test

Plan: docs/plans/add-ai.md (§4 — Milestone 1: Client UI). Branch: feature/add-ai.

## Stage 8 scope (from docs/status/stage-plan.md)
- Shared `.lc-status-dot` (extracted from `.lc-drift-footer-dot`), `useAiConnection` hook, AskAgent changes (Search label, bot icon + status light, Connect/Disconnect button), `AskAgent.test.tsx`.

## Out of scope for this stage (later stages own these — do not build them)
- `ConnectAgentModal`, `OVERLAY.connect` registration, the `responsive.css` priority entry, `ConnectAgentModal.test` → stage 9.
- AskPanel "Connect an AI agent for real answers." line and starter chips → stage 10.
- Any server route (`/api/ai/*`) → stages 11–12. The routes do not exist yet: `GET /api/ai/status` 404s/fails in `npm run dev:client`. The hook must treat a failed/non-OK status call as `disconnected` (no throw, no console noise loop) so the client works now.
- The Connect button has no modal to open yet. Expose it as a callback prop on AskAgent (e.g. `onConnectRequest`) and wire it minimally at the call site so stage 9 only has to plug the modal in — do not invent a stand-in modal.

## Plan text (pasted verbatim, §4 — the parts this stage implements)

**`client/src/components/AskAgent.tsx`**
- Rename the "Go!" button text to **Search** and update its `title` to match.
- Add a **bot icon** on the right side of the input: 🤖 with a status dot. Reuse `.lc-drift-footer-dot` styling, extracted into a shared `.lc-status-dot` class with `--on` (the existing `--svc-green` + pulse) and `--off` (red token from `tokens.css`, no pulse) modifiers. Its tooltip and `aria-label` read "AI agent connected (Claude)" or "No AI agent connected".
- In the expanded footer, next to Search, add **Connect AI Agent** when disconnected and **Disconnect AI Agent** when connected. Use `onMouseDown` + `preventDefault` like the existing button, so the card doesn't collapse first.

**New `client/src/hooks/useAiConnection.ts`**
- Calls `GET /api/ai/status` once on mount and exposes `{ status: 'unknown' | 'connected' | 'disconnected', provider, connect(provider, apiKey), disconnect() }`.
- `unknown` renders the dot grey, so there's no red flash on load for a connected visitor.

(For reference, the server contract these call, from §3:)
| Route | Behaviour |
|---|---|
| `POST /api/ai/connect` `{ provider: 'anthropic' \| 'openai', apiKey }` | Validates the body with a Zod `ConnectRequestSchema`. Checks the key with the provider's free `GET /v1/models`. A 401 returns `400 { errorCode: 'INVALID_KEY' }`. On success it sets the cookie, replacing any existing provider, and returns `{ connected: true, provider }`. |
| `POST /api/ai/disconnect` | Clears the cookie (`Max-Age=0`). Returns `{ connected: false }`. |
| `GET /api/ai/status` | No cookie returns `{ connected: false }`. Otherwise it decrypts the cookie and repeats the `/v1/models` check. A 401 clears the cookie and returns `{ connected: false, reason: 'KEY_REVOKED' }`. A network error keeps it connected, since the check is advisory. |
| (any of status/connect/ask without `AI_COOKIE_SECRET`) | `503 AI_NOT_CONFIGURED` → treat as disconnected on the client. |

`connect()` must surface a failure to its caller (stage 9's modal shows "That key didn't work — check it and try again" and stays open), e.g. by returning/throwing a typed result carrying the `errorCode` — pick one shape and document it in Key decisions.

**Tests** — `client/src/components/__tests__/AskAgent.test.tsx` (Vitest + RTL + jsdom, harness from stage 7):
- shows "Search" (not "Go!"); shows Connect when disconnected and Disconnect when connected; the status dot class follows the connection state. *Protects: the button labels and the light always match reality.*
- Prove the test non-vacuous (break an assertion, see it fail, revert) as stage 7 did.

## Project constraints to honor
- Mobile-first invariant (CLAUDE.md): verify the AskAgent bar/expanded card at ~390px wide and short landscape (844×390) FIRST, then desktop. The bot icon + two footer buttons must fit at 390px without overflow. Visual check via Playwright (`browser-drive`-style) if available; otherwise state clearly in the report that it was not visually verified.
- Colors: use existing tokens from `client/src/styles/tokens.css` (red token for `--off`, `--svc-green` for `--on`); grey for `unknown` from an existing token.
- `.lc-drift-footer-dot` users must keep rendering identically after the extraction.
- Gates: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run validate` must all pass.
