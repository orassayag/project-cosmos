# Stage 19 work brief — §7 client: AskPanel stream reader, usage line, error messages, INVALID_KEY disconnect + AskPanel.test

## Stage scope
Client-only (`client/`). No server changes (the server `POST /api/ai/ask` NDJSON stream landed in stage 17).
- `client/src/components/AskPanel.tsx`: when **connected** (`useAiConnection` status `connected`), replace the fake word timer with a real `fetch('POST /api/ai/ask', { question })` and a reader over `response.body` that parses NDJSON line by line (buffer partial lines across chunks; ignore blank lines; a malformed line must not crash the panel). When **disconnected** (or `unknown`), the existing fake typing + `DEMO_ANSWERS` + "Connect an AI agent for real answers." prompt stay exactly as today.
  - `token` → append `text` as it arrives. Thinking dots show until the first token; `onAnswerStart` fires on the first token (once per ask).
  - `action` → forward the parsed line unchanged to the existing `onAction?: (action: AskAction) => void` prop (stage 18 already typed `AskAction` in `AskPanel.tsx` and wired `App.handleAskAction`).
  - `usage` → a small muted line under the answer: `≈ 1,322 tokens` (input + output, formatted with `Intl.NumberFormat`). Off-topic and direct-action replies carry no `usage` event, so show nothing for them.
  - `error` → show the mapped message from the table below. On `INVALID_KEY`, call `POST /api/ai/disconnect` exactly once (reuse `useAiConnection().disconnect()` — do not write a parallel fetch) so the light flips red.
  - `done` → terminal signal. Protocol (stage 17): every non-aborted stream ends with exactly one `done`, including after an `error` — treat `error` as the outcome, `done` as the terminal signal.
  - Non-2xx HTTP responses before the stream (`401 NOT_CONNECTED`, `503 AI_NOT_CONFIGURED`, `400 INVALID_REQUEST`, network failure) must show a sensible message rather than hang or crash; `NOT_CONNECTED` should leave the connection `disconnected`. Keep this minimal and consistent with the error table.
  - Abort the in-flight request (`AbortController`) when a new question is asked or the panel unmounts/closes; an aborted request shows no error.
  - The server's direct-action text is `Playing *<title>* for you ▶` (asterisks literal). Render `*Title*` as emphasis (or strip the asterisks) — do not show raw asterisks. Keep it simple; no markdown library unless one is already a dependency.
- Keep `AskPanel.tsx` readable: if the reader/parser grows, extract the pure NDJSON line parsing/stream reading into a small camelCase `.ts` module under `client/src/components/` or `client/src/hooks/` (naming rules: no `utils`/`helpers`), and test it.
- Tests: `client/src/components/__tests__/AskPanel.test.tsx` — a stubbed stream (stub global `fetch`) that emits `{"type":"error","errorCode":"INVALID_KEY"}` triggers **exactly one** `POST /api/ai/disconnect` and leaves `useAiConnection` in `disconnected`. Reasonable extras: tokens stream and render; `usage` renders the `≈ N tokens` line; an off-topic stream (token + done) shows no usage line; an `action` line calls `onAction` with the parsed object. Non-vacuous proof via mutations, as prior stages did.
- This stage also closes stage 18's open question as far as practical: the AskPanel → `onAction` path should be covered by a test.
- Mobile-first invariant: the usage line and error message sit inside the existing answer panel — verify at ~390px (and short landscape) they don't overflow or push the panel off-screen; no new panel is added, so the close-button contract and one-card-at-a-time rule are unaffected. If you can drive the dev client, a 390px check is welcome; otherwise say explicitly it was not visually verified.
- Out of scope: server changes, final preview-deploy acceptance (stage 20), the stage-12+ carry-overs (moving `AI_PROVIDERS` out of `logger.ts`, `vercel env pull` smoke, root `"dev": "vercel dev"`) — though a `useAiConnection` unit test is fine to add if the AskPanel test naturally needs its behaviour pinned.

## Plan text (pasted verbatim from docs/plans/add-ai.md)

### §7 — Streaming protocol, errors, and usage

`POST /api/ai/ask` responds with `Content-Type: application/x-ndjson`, one JSON event per line:

```
{"type":"token","text":"The checkout flow starts at"}
{"type":"action","kind":"highlight","serviceIds":["checkout","payments-gateway"]}
{"type":"action","kind":"playScenario","scenarioId":"checkout"}
{"type":"usage","inputTokens":1180,"outputTokens":142}
{"type":"error","errorCode":"OUT_OF_CREDIT"}
{"type":"done"}
```

**A2 streaming:** `AskPanel` replaces its fake word timer, when connected, with a reader over `response.body`. Tokens append as they arrive, the thinking dots show until the first token, and `onAnswerStart` fires on the first token. When disconnected, the existing fake typing stays.

**A4 usage:** a small muted line under the answer reads "≈ 1,322 tokens". It is built from the `usage` event (input + output, formatted with `Intl.NumberFormat`). Off-topic and direct-action replies show nothing, since they cost the visitor nothing.

**Error mapping** (`server/src/agent/providerErrors.ts`, a pure function from provider error to `errorCode`)

| Provider response | `errorCode` | Message shown in AskPanel |
|---|---|---|
| Anthropic 400 whose message contains "credit balance is too low"; OpenAI 429 with `code: 'insufficient_quota'` | `OUT_OF_CREDIT` | "Your AI account is out of credit — top it up with your provider, then ask again." |
| Any other 429 | `RATE_LIMITED` | "Too many questions at once — try again in a moment." |
| 401 | `INVALID_KEY` | "Your key no longer works." The response headers are already sent by then, so the server can't clear the cookie here; the client calls `POST /api/ai/disconnect` (which clears it) and then flips the light red. |
| Anything else | `PROVIDER_ERROR` | "The AI agent hit a problem — please try again." |

Errors thrown inside the server use a typed `ProviderError(message, { errorCode, cause })`.

Client — `client/src/components/__tests__/AskPanel.test.tsx`: a stubbed stream that emits `{"type":"error","errorCode":"INVALID_KEY"}` triggers exactly one `POST /api/ai/disconnect` and leaves `useAiConnection` in `disconnected`. *Protects: a key found dead mid-answer is logged out before the next question (round-2 I4).*

### §4 — relevant client context
**New `client/src/hooks/useAiConnection.ts`**
- Calls `GET /api/ai/status` once on mount and exposes `{ status: 'unknown' | 'connected' | 'disconnected', provider, connect(provider, apiKey), disconnect() }`.
- `unknown` renders the dot grey, so there's no red flash on load for a connected visitor.

**Disconnected behaviour:** `AskPanel` keeps `DEMO_ANSWERS`, with one extra line under the joke: "Connect an AI agent for real answers." That line is a button that opens the modal.

### §3 — relevant server behaviour
- `AI_COOKIE_SECRET` is required only by the routes that read or write the cookie (`connect`, `status`, `ask`). When it is missing they return `503 { errorCode: 'AI_NOT_CONFIGURED' }` and log one error; `disconnect` still clears the cookie. The client treats `AI_NOT_CONFIGURED` from `status` as disconnected and hides the Connect button.
| `POST /api/ai/disconnect` | Clears the cookie (`Max-Age=0`). Returns `{ connected: false }`. |

### Issue resolutions
| I4 (round 2) | A dead key found mid-answer can't be logged out in that same response | Claude (adversarial) | Fixed | The client calls `POST /api/ai/disconnect` on an `INVALID_KEY` event. Design §7. |

### Final acceptance (steps this stage enables; run in stage 20)
  5. Ask "what's the weather?" and get a funny reply with no usage line.
  6. Ask "play the checkout flow": the scenario plays with no usage line.
  7. Ask "what happens when a payment fails?": the answer streams, **at least two named services glow**, and a usage line appears.
