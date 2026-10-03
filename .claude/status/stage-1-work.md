# Stage 1 work brief — Keyless server

Plan: docs/plans/ai-refactor.md · Branch: feature/ai-refactor
Stage scope: plan §1.1 in full, plus the **server half** of §1.4.

## Boundaries for this stage
- Server only. The client (`client/`) is stage 2 — do not edit client files, except if a server
  type change would break `pnpm build`/`pnpm typecheck` for the client (e.g. `client/src/api/cosmos-api.ts`
  is emitted from `server/src/cosmos/apiTypes.ts` by `pnpm types:emit`). Prefer leaving shared
  API types the client still imports in place for stage 2 rather than editing client code; if a
  type must change, run `pnpm types:emit` and note it in the report.
- The client will still call `/ai/connect` until stage 2; that interim 404 is accepted.
- `.env.example`, `scripts/fresh-start.mjs`, and README edits for `AI_COOKIE_SECRET` are stage 3 —
  leave them. `server/src/agent/offTopicAnswers.ts` / joke answers are replaced in stage 4 — leave them.
- §1.4 server half for this stage: delete `cookieCrypto.ts`, `connectRequestSchema.ts`
  (`ConnectRequestSchema`), `getCookieSecret`, and every `AI_COOKIE_SECRET` read in `server/src`.

## Plan §1.1 (verbatim)
#### 1.1 Server: env-only keys, local only (I1, I8)
- **The local dev entry point turns the agent on (I1).** `server/scripts/dev-server.ts`:
  - `serve({ fetch: app.fetch, port: DEV_SERVER_PORT, hostname: '127.0.0.1' }, …)`. The API
    listens only on loopback. Vite's `/api` proxy already targets `localhost`, so
    `pnpm dev` is unchanged.
  - Sets `process.env.COSMOS_LOCAL_AGENT = '1'` *before* the dynamic `import('../src/app.js')`.
    This is the only place that sets it. It is not read from `.env` files: `getAgentConfig()`
    ignores a value that came from a file, because the dev script deletes any loaded
    `COSMOS_LOCAL_AGENT` and then sets it itself. So no deployed host can switch the agent on
    through configuration alone.
- New `server/src/agentConfig.ts` (replaces the cookie half of `config.ts`):
  `getAgentConfig(): { ok: true; config: AgentConfig } | { ok: false; reason: 'AI_NOT_LOCAL' | 'AI_NOT_CONFIGURED' }`
  with `AgentConfig = { provider: 'anthropic' | 'openai'; apiKey: string; gatewayApiKey: string | null }`.
  - `process.env.VERCEL` set **or** `COSMOS_LOCAL_AGENT !== '1'` → `{ ok: false, reason: 'AI_NOT_LOCAL' }`.
    The Vercel check is the backup (I1). Logged once at INFO, `errorCode: 'AI_DISABLED_NOT_LOCAL'`.
  - Local, but neither provider key set (whitespace-only counts as unset) →
    `{ ok: false, reason: 'AI_NOT_CONFIGURED' }`.
  - Provider precedence: `ANTHROPIC_API_KEY` wins over `OPENAI_API_KEY` when both are set
    (logged once at INFO, `errorCode: 'AI_PROVIDER_BOTH_SET'`).
  - `AI_GATEWAY_API_KEY` stays optional. Without it, classification uses the local keyword
    fallback.
  - Read on every call, never at import, so the map still starts with no AI env.
- `server/src/app.ts`:
  - `GET /ai/status` → `200 { connected: true, provider }` or `503 { errorCode: <reason> }`
    with the reason above (I8). It does not ping the provider. A bad key shows up on the first
    ask instead (1.5 / 2.4).
  - `POST /ai/ask` resolves `getAgentConfig()` instead of the cookie. If `ok: false`, it
    returns 503 with the same `errorCode`.
  - Delete `/ai/connect`, `/ai/disconnect`, `readAiCookie`, `clearAiCookie`, `cookieCrypto.ts`,
    `ConnectRequestSchema`, `getCookieSecret`.
  - `answerQuestion` / `createChatModel` take `AgentConfig` in place of `AiCookiePayload`
    (same three fields, so the factory body barely changes).
- Verify:
  - `server/src/__tests__/agentConfig.test.ts` (new, unit). Protects: `VERCEL` set ⇒
    `AI_NOT_LOCAL` even with keys and the flag set; flag missing ⇒ `AI_NOT_LOCAL`; local with no
    keys ⇒ `AI_NOT_CONFIGURED`; Anthropic wins when both are set; whitespace-only keys count as
    missing.
  - `server/src/__tests__/statusRoute.test.ts`, `askRoute.test.ts` (rewrite, route-level).
    Protects: 503 carries the right `errorCode` for each reason; ask streams with env keys; no
    cookie is read or set.
  - `server/src/__tests__/devServer.test.ts` (new, unit, imports a small exported
    `startDevServer` helper the script calls). Protects: binds `127.0.0.1`; sets
    `COSMOS_LOCAL_AGENT` itself even when an env file tried to set it.
  - Delete `connectRoute.test.ts`; trim `config.test.ts` to what remains.

## Plan §1.4 (verbatim — only the server parts listed above are in this stage)
#### 1.4 Removal of leftovers
- Delete: `cookieCrypto.ts`, `connectRequestSchema.ts`, `AI_COOKIE_SECRET` everywhere
  (`.env.example`, `scripts/fresh-start.mjs`, README), the visitor JEV key field, the joke
  answers in `AskPanel.tsx` and `server/src/agent/offTopicAnswers.ts` (replaced by the fixed
  reply in 2.2), the random-star fallback in `App.tsx`, and the key-rejected → disconnect
  handling (I7).
- `server/.env.example` documents exactly `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `AI_GATEWAY_API_KEY`, with the "local only, billed to this key" note. The `README.md` setup
  section is updated to match.
- Verify: `pnpm typecheck` + `pnpm lint` (catches unused imports and routes);
  `grep -r AI_COOKIE_SECRET` returns nothing outside `versions/`.
