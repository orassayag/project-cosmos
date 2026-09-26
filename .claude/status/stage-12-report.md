## Files
package-lock.json
server/package.json
server/src/app.ts
server/src/providerKeyCheck.ts
server/src/schemas/connectRequestSchema.ts
server/src/__tests__/connectRoute.test.ts
server/src/__tests__/statusRoute.test.ts
server/src/__tests__/config.test.ts

## Summary
The server now has the three key-handling routes on the stage-11 Hono app. `POST /api/ai/connect` validates the body with `ConnectRequestSchema`, checks the key against the provider's free `GET /v1/models`, and stores it in the encrypted `cosmos_ai` cookie only if it works. `POST /api/ai/disconnect` clears the cookie and works even with no `AI_COOKIE_SECRET`. `GET /api/ai/status` re-checks the stored key on every call: a 401 clears the cookie and returns `KEY_REVOKED`, and a provider outage leaves the user connected. `zod` is now a direct server dependency (`^4.6.5`, which was already in the lockfile as a transitive dependency).

| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm run lint` | pass (0 errors; the same 2 old exhaustive-deps warnings in AskPanel.tsx and Map.tsx) |
| `npm test` | pass: client 12/12, server 25/25 (5 files, 13 of the tests are new) |
| `npm run validate` | pass, no drift |
| Mutation proofs (each failed its test, then restored; diff confirmed clean) | cookie without `HttpOnly` → connectRoute fails. 401 key accepted → connectRoute fails. Cookie not cleared on revoke → statusRoute fails. Disconnect blocked without secret → config.test fails. Invalid field not named → 3 validation cases fail. Secret read at import → config.test "imports cleanly" fails. |
| `vercel dev -L` smoke | not run. See Open questions. |

## Commit message
feat(server): add AI connect, disconnect and status routes with key check

Only keys the provider accepts get stored, always in the locked-down encrypted
cookie, and status re-checks the key so the green light never stays on for a
revoked key. Disconnect does not depend on AI_COOKIE_SECRET, so a missing secret turns off AI and nothing else.

## Key decisions
- **Where the routes live:** they are registered straight on the default-exported app in `server/src/app.ts` (`app.post('/ai/connect')`, `app.post('/ai/disconnect')`, `app.get('/ai/status')`). There is no sub-router. Stage 17 should add `/ai/ask` the same way.
- **Response shapes** (they match `useAiConnection` and the `ConnectAgentModal` error map):
  - connect success: `200 { connected: true, provider }`
  - bad key: `400 { errorCode: 'INVALID_KEY' }`
  - bad body: `400 { errorCode: 'INVALID_REQUEST', field, message }`. `field` is `provider`, `apiKey`, or `body` (for non-JSON). The client maps this to `UNEXPECTED_RESPONSE`.
  - provider down or unexpected status on connect: `502 { errorCode: 'PROVIDER_UNAVAILABLE' }`. The client maps this to `UNEXPECTED_RESPONSE`.
  - no secret: `503 { errorCode: 'AI_NOT_CONFIGURED' }` (from connect and status)
  - disconnect: `200 { connected: false }`
  - status: `{ connected: false }`, `{ connected: false, reason: 'KEY_REVOKED' }`, or `{ connected: true, provider }`
  - No mismatches with the client. `reason` is ignored by the client, which is fine.
- **Order of checks in connect:** secret, then body, then key check. With no secret, connect returns 503 before it reads the body or calls the provider.
- **Key check:** `checkProviderKey(provider, apiKey): Promise<'valid' | 'invalid' | 'unavailable'>` in `server/src/providerKeyCheck.ts`.
  - Only a 401 counts as `invalid`. Network errors, the 5s timeout, and any other non-2xx status count as `unavailable`.
  - It uses the global `fetch`, so tests stub it with `vi.stubGlobal('fetch', …)`.
  - Anthropic requests send `x-api-key` plus `anthropic-version: 2023-06-01`. OpenAI requests send `Authorization: Bearer`.
  - The response body is cancelled without being read.
- **Schema:** `ConnectRequestSchema` is in `server/src/schemas/connectRequestSchema.ts` and also exports `type ConnectRequest`.
  - `provider` is `z.enum(AI_PROVIDERS)`.
  - `apiKey` is trimmed, must not be empty, and is capped at 512 characters so the cookie stays well under the 4 KB limit.
- **Clearing the cookie:** `deleteCookie(context, AI_COOKIE_NAME, AI_COOKIE_OPTIONS)`. This sends `Max-Age=0` with the same Path, Secure, HttpOnly and SameSite values.
- **Logs:**
  - `INVALID_KEY` (warn) and `KEY_REVOKED` (info) are logged with `provider`.
  - `PROVIDER_UNREACHABLE` and `PROVIDER_UNAVAILABLE` (warn) come from the key check.
  - No key, body or header is ever logged. The tests assert the key never appears in console output, even when the fetch error message contains it.
- **config.test.ts:** uses `vi.resetModules()` plus a dynamic `import('../app.js')` in each case, so config's log-once flag is reset every time. The `ask` → 503 case is left for stage 17 (there is a note at the top of the file).

## Open questions
- **File ceiling:** 8 files against a ceiling of 6 (7 hand-written plus `package-lock.json`). The three test files are required by the plan, and the key check is kept in its own module.
- **`AI_PROVIDERS` / `AiProvider`** still live in `server/src/logger.ts`. The schema uses `z.enum(AI_PROVIDERS)`, but moving the constant into the schema file would also have meant editing `logger.ts` and `cookieCrypto.ts`, which pushes the stage further over the ceiling. Worth a small follow-up: move them into `schemas/connectRequestSchema.ts` and re-point both imports.
- **`vercel dev -L` smoke was not run.**
  - Another `vercel dev` for this project was already running (PID 38141, port 3918) and held the dev lock. I did not kill it because it is not mine.
  - That instance still serves the code from before this stage (`/api/ai/status` → 404).
  - Root `.env.local` contains only `VERCEL_OIDC_TOKEN` and no `AI_COOKIE_SECRET`. So it is still unverified whether `vercel env pull` values reach the `server` service.
  - Suggested check after restarting `vercel dev`:
    - Without the secret, `/api/ai/status` should return `503 AI_NOT_CONFIGURED`.
    - With `AI_COOKIE_SECRET` set, it should return `{ "connected": false }`.
- **Connect with a 403 or 5xx from the provider** returns 502 `PROVIDER_UNAVAILABLE` rather than `INVALID_KEY`, because the plan only names 401. If a key that exists but lacks permissions should also count as invalid, add 403 to the check.
- **Still deferred:** the `useAiConnection` client unit test (kept out so this stage stays server-only). The root `"dev": "vercel dev"` script and its README line (carried over from stage 6) are also still not done.
