# Stage 12 work brief — M2: connect / disconnect / status routes + ConnectRequestSchema + key check + route/config tests

Plan: `docs/plans/add-ai.md` (§3). Branch: `feature/add-ai`. Builds on stage 11 (see ledger: `app.ts`, `config.ts`, `logger.ts`, `cookieCrypto.ts`).

## In scope
- `POST /api/ai/connect`, `POST /api/ai/disconnect`, `GET /api/ai/status` registered on the stage-11 Hono app (`app.post('/ai/connect', …)` etc. → `/api/ai/…`).
- Zod `ConnectRequestSchema` (in a `server/src/schemas/` file per naming rules) — make it the canonical provider source (`z.enum(AI_PROVIDERS)`), moving `AI_PROVIDERS`/`AiProvider` out of `logger.ts` if that fits the file ceiling; otherwise reference them and note it.
- The provider key check (free `GET /v1/models`, stubbable `fetch`).
- Tests: `connectRoute.test.ts`, `statusRoute.test.ts`, `config.test.ts` (per §3 below).
- `zod` added as a server dependency if not already resolvable there.

## Out of scope
- `POST /api/ai/ask` (stage 17). In `config.test.ts`, cover `status`/`connect` → 503 and `disconnect` → 200 only; note that the `ask` 503 case lands with stage 17.
- Root `"dev": "vercel dev"` + README line (stage 6 carry-over) — do not add.
- `useAiConnection` client unit test — do not add (keeps this stage server-only); flag in Open questions as still deferred.

## Plan §3 — Milestone 2: Server (key handling) (pasted verbatim)

**Stack:** a Node service in `server/`. Use Hono on Vercel's Node runtime (Node 24 on Vercel, 22 locally per `.nvmrc`). Set root `engines.node` to `>=22`, because AI SDK 7 requires Node 22+ and ESM. In `server/tsconfig.json`, set `module`/`moduleResolution: NodeNext`. That makes every extensionless relative import a compile error, so the `.js` rule (L016) is enforced by the type-checker instead of discovered at deploy time.

**Routes**

| Route | Behaviour |
|---|---|
| `POST /api/ai/connect` `{ provider: 'anthropic' \| 'openai', apiKey }` | Validates the body with a Zod `ConnectRequestSchema`. Checks the key with the provider's free `GET /v1/models` (Anthropic `x-api-key` + `anthropic-version`; OpenAI `Authorization: Bearer`). A 401 returns `400 { errorCode: 'INVALID_KEY' }`. On success it sets the cookie, replacing any existing provider, and returns `{ connected: true, provider }`. |
| `POST /api/ai/disconnect` | Clears the cookie (`Max-Age=0`). Returns `{ connected: false }`. |
| `GET /api/ai/status` | No cookie returns `{ connected: false }`. Otherwise it decrypts the cookie and repeats the `/v1/models` check. A 401 clears the cookie and returns `{ connected: false, reason: 'KEY_REVOKED' }`. A network error keeps it connected, since the check is advisory. |
| `POST /api/ai/ask` `{ question }` | Streamed. See §5–§7. |

**Cookie:** `cosmos_ai=<base64url(iv ‖ ciphertext ‖ authTag)>; HttpOnly; Secure; SameSite=Strict; Path=/api/ai; Max-Age=2592000`. The payload is `{ provider, apiKey }` encrypted with AES-256-GCM using `AI_COOKIE_SECRET` through Node's built-in `crypto`. A tampered or undecryptable cookie is treated as "not connected" and cleared. The server stores nothing: it decrypts per request, uses the key, and drops it.

**Logging:** use a structured logger. It never logs request bodies, headers, or the cookie. Error logs carry only `{ errorCode, provider, noPHI: true }`.

**Tests** — `server/src/__tests__/`, Vitest, unit layer:
- `cookieCrypto.test.ts`: (done in stage 11)
- `connectRoute.test.ts`, with the provider `fetch` stubbed: a valid key sets a cookie with all four attributes; a 401 returns `INVALID_KEY` and sets no cookie; a bad body returns a named validation error. *Protects: only working keys get stored, and the cookie is always locked down.*
- `statusRoute.test.ts`: a revoked key (stub returns 401) clears the cookie and reports disconnected. *Protects: the light never stays green on a dead key (I9).*
- `config.test.ts`: the app module imports with neither env var set; `status`/`connect`/`ask` return `503 AI_NOT_CONFIGURED` without `AI_COOKIE_SECRET`; `disconnect` still returns 200. *Protects: a missing secret disables AI only, never the whole site (round-2 I1).*

## Relevant issue resolutions (pasted)
- I4: AES-256-GCM encrypted HttpOnly/Secure/SameSite=Strict cookie. Stateless server, no logging of secrets.
- I9: The green light can lie → key checked on connect and on every page load. A 401 disconnects.
- I12: `.js` on every relative import under `server/`, enforced by `moduleResolution: NodeNext`.
- Round-2 I1: Only `AI_COOKIE_SECRET` is required, and only by the cookie routes; a missing gateway key falls back to `localRelevance`.
- Round-2 I4: The client calls `POST /api/ai/disconnect` on an `INVALID_KEY` event — so disconnect must work even without `AI_COOKIE_SECRET`.

## Client contract to honour
Client error map (stage 9 `ConnectAgentModal`): `INVALID_KEY`, `AI_NOT_CONFIGURED`, network error, unexpected response. Client `useAiConnection` (stage 8) calls `/api/ai/status`, `/api/ai/connect`, `/api/ai/disconnect` — read it and match its expected response shapes exactly; flag any mismatch.

## Verification required
`npm run typecheck`, `npm run build`, `npm run lint`, `npm test`, `npm run validate`. Non-vacuous proof: at least one mutation per protected behaviour (e.g. drop an attribute from the cookie; skip clearing on 401) shown to fail the relevant test, then restored. If feasible, a `vercel dev -L` smoke of `/api/ai/status` with and without `AI_COOKIE_SECRET` (and note whether `.env.local` reaches the server service — open ledger item).
