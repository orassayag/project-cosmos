# Stage 11 work brief — M2: Hono app, config (AI_NOT_CONFIGURED), structured logger, cookieCrypto + cookieCrypto.test

Stage line (from docs/status/stage-plan.md):
> Stage 11: M2: Hono app, config (AI_NOT_CONFIGURED), structured logger, cookieCrypto + cookieCrypto.test

Out of scope for THIS stage (later stages own them — do not build them now):
- Stage 12: connect / disconnect / status routes, `ConnectRequestSchema`, provider key check, `connectRoute.test.ts`, `statusRoute.test.ts`, `config.test.ts`.
- Stage 13+: classification, agent, `/api/ai/ask`.

What this stage must deliver (foundation stage 12 builds the routes on):
1. **Hono app** in `server/` — the app module and its Vercel Node entry (Hono on Vercel's Node runtime; routes are declared with the `/api` prefix because the server receives the full path). Add the `hono` dependency to `server/package.json`. The app module must import cleanly with neither env var set (stage 12's `config.test.ts` relies on this). A trivial placeholder route is fine only if needed to make the app valid; do not implement the four AI routes.
2. **Config** — reads `AI_COOKIE_SECRET` and `AI_GATEWAY_API_KEY` lazily/safely; never throws at import. Expose what stage 12 needs to return `503 { errorCode: 'AI_NOT_CONFIGURED' }` from cookie routes when `AI_COOKIE_SECRET` is missing (log one error, not per-request spam), and a way for classification (later) to know the gateway key is missing.
3. **Structured logger** — never logs request bodies, headers, or the cookie. Error logs carry only `{ errorCode, provider, noPHI: true }`.
4. **cookieCrypto** — AES-256-GCM via Node's built-in `crypto`, secret = `AI_COOKIE_SECRET` (32 bytes, base64). Encodes payload `{ provider, apiKey }` as `base64url(iv ‖ ciphertext ‖ authTag)`. Decrypt of a tampered/undecryptable/wrong-secret value must be rejected (stage 12 treats it as "not connected" and clears the cookie). Cookie attribute constants (`cosmos_ai`, HttpOnly, Secure, SameSite=Strict, Path=/api/ai, Max-Age=2592000) may live here or in config for stage 12 to use.
5. **`server/src/__tests__/cookieCrypto.test.ts`** (Vitest): round-trip; flipped byte in ciphertext rejected; flipped byte in auth tag rejected; wrong secret rejected.

Hard constraints:
- `server/tsconfig.json` must use `module`/`moduleResolution: NodeNext` (check what stage 3 set); **every relative import under `server/` ends in `.js`** (L016).
- Root `engines.node` `>=22` (check whether already set).
- Follow the user's global rules: typed error classes with a context object `{ errorCode, error? }` (only as many classes as callers need to discriminate), no `console.*` outside the logger implementation itself, descriptive names, camelCase TS filenames, Zod schemas in `schemas/`, plain types in `types/`.
- Ceilings: ≤6 files, ≤300 lines/file, target ≤250 hand-written LOC.

## Plan text (pasted verbatim from docs/plans/add-ai.md)

### §2 excerpt — environment variables

- The server receives the full path (`/api/ai/…`), so its routes are declared with the `/api` prefix.
- Environment variables (Vercel project, Production + Preview): `AI_GATEWAY_API_KEY` (already held), and `AI_COOKIE_SECRET` (32 random bytes, base64; generate with `openssl rand -base64 32`). Neither variable stops the server from starting — the map needs no AI:
  - `AI_COOKIE_SECRET` is required only by the routes that read or write the cookie (`connect`, `status`, `ask`). When it is missing they return `503 { errorCode: 'AI_NOT_CONFIGURED' }` and log one error; `disconnect` still clears the cookie. The client treats `AI_NOT_CONFIGURED` from `status` as disconnected and hides the Connect button.
  - `AI_GATEWAY_API_KEY` missing → classification uses the free `localRelevance` fallback (§5) with a single `JEV_UNAVAILABLE` warning at first use, not per request.

### §3 — Milestone 2: Server (key handling)

**Stack:** a Node service in `server/`. Use Hono on Vercel's Node runtime (Node 24 on Vercel, 22 locally per `.nvmrc`). Set root `engines.node` to `>=22`, because AI SDK 7 requires Node 22+ and ESM. In `server/tsconfig.json`, set `module`/`moduleResolution: NodeNext`. That makes every extensionless relative import a compile error, so the `.js` rule (L016) is enforced by the type-checker instead of discovered at deploy time.

**Routes** (stage 12 — context only)

| Route | Behaviour |
|---|---|
| `POST /api/ai/connect` `{ provider: 'anthropic' \| 'openai', apiKey }` | Validates the body with a Zod `ConnectRequestSchema`. Checks the key with the provider's free `GET /v1/models`. A 401 returns `400 { errorCode: 'INVALID_KEY' }`. On success it sets the cookie, replacing any existing provider, and returns `{ connected: true, provider }`. |
| `POST /api/ai/disconnect` | Clears the cookie (`Max-Age=0`). Returns `{ connected: false }`. |
| `GET /api/ai/status` | No cookie returns `{ connected: false }`. Otherwise it decrypts the cookie and repeats the `/v1/models` check. A 401 clears the cookie and returns `{ connected: false, reason: 'KEY_REVOKED' }`. A network error keeps it connected. |
| `POST /api/ai/ask` `{ question }` | Streamed. See §5–§7. |

**Cookie:** `cosmos_ai=<base64url(iv ‖ ciphertext ‖ authTag)>; HttpOnly; Secure; SameSite=Strict; Path=/api/ai; Max-Age=2592000`. The payload is `{ provider, apiKey }` encrypted with AES-256-GCM using `AI_COOKIE_SECRET` through Node's built-in `crypto`. A tampered or undecryptable cookie is treated as "not connected" and cleared. The server stores nothing: it decrypts per request, uses the key, and drops it.

**Logging:** use a structured logger. It never logs request bodies, headers, or the cookie. Error logs carry only `{ errorCode, provider, noPHI: true }`.

**Tests** — `server/src/__tests__/`, Vitest, unit layer:
- `cookieCrypto.test.ts`: encrypt → decrypt round-trip. A flipped byte in the ciphertext or auth tag is rejected. A wrong secret is rejected. *Protects: a forged or tampered cookie can never be read as a valid key.*
- (stage 12) `connectRoute.test.ts`, `statusRoute.test.ts`, `config.test.ts` — `config.test.ts`: the app module imports with neither env var set; `status`/`connect`/`ask` return `503 AI_NOT_CONFIGURED` without `AI_COOKIE_SECRET`; `disconnect` still returns 200.

Issue resolutions relevant here: I4 (AES-256-GCM HttpOnly/Secure/SameSite=Strict cookie, stateless, no secret logging), I12 (`.js` on every relative import, NodeNext), round-2 I1 (only `AI_COOKIE_SECRET` required, only by cookie routes; missing gateway key → free fallback).
