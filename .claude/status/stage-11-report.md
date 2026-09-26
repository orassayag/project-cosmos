## Files
package.json
package-lock.json
server/package.json
vercel.json
server/src/app.ts
server/src/config.ts
server/src/logger.ts
server/src/cookieCrypto.ts
server/src/__tests__/cookieCrypto.test.ts

## Summary
The `server/` workspace now has a Hono app (`server/src/app.ts`, `basePath('/api')`, JSON `404 NOT_FOUND` / `500 INTERNAL_ERROR` handlers) that doubles as the Vercel entry. It also has a lazy config module (`getCookieSecret()` returns null and logs one error when `AI_COOKIE_SECRET` is missing or not 32 bytes; `getGatewayApiKey()` returns null when the key is unset). A structured JSON logger only ever writes `{ level, scope, message, errorCode, provider, noPHI: true, time }`. `cookieCrypto` seals and opens `{ provider, apiKey }` as `base64url(iv ‖ ciphertext ‖ authTag)` with AES-256-GCM. Root `engines.node` is now `>=22`, and `hono@^4.13.9` is a server dependency.

| Gate | Result |
|---|---|
| `npm run typecheck` | pass (client + server + server/scripts) |
| `npm run build` | pass |
| `npm run lint` | pass: 0 errors, 2 pre-existing exhaustive-deps warnings (AskPanel.tsx, Map.tsx) |
| `npm test` | pass: client 12/12, server 7/7 (5 new in cookieCrypto.test.ts) |
| `npm run validate` | pass: 0 errors, no drift |
| Non-vacuous proof | Mutation A (the decrypt catch accepts a forged payload) made 3 tamper/wrong-secret tests fail. Mutation B (skipping `decipher.final()`, so no auth check) made the auth-tag test fail. The file was restored and the tests are green. |
| No-env import probe | With both env vars unset, `app.request('/api/ai/status')` → `404 {"errorCode":"NOT_FOUND"}`. Two `getCookieSecret()` calls → exactly one `AI_NOT_CONFIGURED` error line. |
| `vercel dev -L` | Without the `vercel.json` change only `client` is detected and `/api/*` gives `502 Cannot route to service server`. With `entrypoint: src/app.ts`, both `client [Vite]` and `server [Hono]` are detected, `/api/ai/status` reaches Hono with the full path (JSON 404), and `/` gives 200. |

## Commit message
feat(server): add Hono app, lazy AI config, structured logger and cookie crypto

Lays the server foundation the AI connect/status/ask routes build on in the next stage.
Env vars are read lazily so the map still deploys and boots with no AI configured.
The cookie is AES-256-GCM sealed so a tampered or forged cookie can never be read as a key.

## Key decisions
- **One file is both the app and the Vercel entry.** `server/src/app.ts` is on Vercel's Hono entrypoint list. `vercel.json` still has to pin `"entrypoint": "src/app.ts"` on the `server` service: without it, `vercel dev` does not detect the server at all (verified).
- **Routes are declared under `/api`:** stage 12 registers `app.post('/ai/connect', …)` etc. on the default-exported app, which resolves to `/api/ai/connect`. Tests can use `app.request('/api/ai/…')` with no server.
- **Decrypt returns `AiCookiePayload | null` and never throws.** Stage 12 treats null as "not connected" and clears the cookie. There is no error class, because no caller needs to `instanceof`-discriminate. A rejected cookie logs one `warn` with `errorCode: 'AI_COOKIE_REJECTED'`. The decrypted JSON is shape-checked (provider ∈ `AI_PROVIDERS`, non-empty `apiKey`).
- **Cookie constants live in `cookieCrypto.ts`:**
  - `AI_COOKIE_NAME = 'cosmos_ai'`.
  - `AI_COOKIE_OPTIONS` is typed against Hono `setCookie`'s options: `httpOnly`, `secure`, `sameSite: 'Strict'`, `path: '/api/ai'`, `maxAge: 2592000`.
  - For disconnect, use `{ ...AI_COOKIE_OPTIONS, maxAge: 0 }` or `deleteCookie` with the same path.
- **Config API:**
  - `getCookieSecret(): Buffer | null` is read per call, never at import. Null means respond `503 { errorCode: AI_NOT_CONFIGURED }`.
  - The one-time error log uses a module-level flag, so a stage-12 `config.test.ts` that asserts "one error" needs `vi.resetModules()` between cases.
  - A malformed secret (not 32 bytes after base64 decoding) logs `AI_COOKIE_SECRET_INVALID` and is also treated as not configured.
  - `getGatewayApiKey(): string | null` does not warn. Stage 13 owns the once-only `JEV_UNAVAILABLE` warning.
- **The logger allowlists fields by name** (`errorCode`, `provider`) and never spreads, so passing a wider object cannot leak a body, header or cookie. Every line carries `noPHI: true`. The logger module is the only place that uses `console.*`.
- **`AI_PROVIDERS` / `AiProvider` sit in `logger.ts` for now**, because the log fields need them and a separate `types/` file would have broken the file ceiling. Stage 12's Zod `ConnectRequestSchema` should become the canonical source (e.g. `z.enum(AI_PROVIDERS)`), or move them.
- **`app.onError` replaces Hono's default handler**, which prints the raw error. It logs only `INTERNAL_ERROR` because of the plan's "error logs carry only `{ errorCode, provider, noPHI }`" rule. This is a deliberate trade against the global "log with context" rule.

## Open questions
- **File ceiling:** 8 hand-written files against a ceiling of 6 (`package-lock.json` is extra). The overage comes from the one-line `engines` edit, the `hono` dependency line, and the `vercel.json` entrypoint pin; the pin was needed for the server to run at all. Accept, or move the `engines`/`vercel.json` lines to another stage?
- **Root `dev` → `vercel dev` (stage 6 carry-over) is not done**, because it would add root `package.json` script + README (9–10 files). It is now verified feasible: `vercel dev -L` with the pinned entrypoint serves both services on one port. It needs a small follow-up (root `"dev": "vercel dev"` + README line → `npm run dev`). Still unverified: whether `.env.local` from `vercel env pull` reaches the server service. Check that with stage 12's first cookie route.
- `server/package.json` keeps its stage-3 `build` script (`tsc --noEmit`). Vercel's Node-backend guidance says not to add a build script for transpilation. This one emits nothing, so it should be harmless, but confirm it on the first preview deploy.
