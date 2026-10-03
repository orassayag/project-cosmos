# Stage 1 report — Keyless server

## Files
server/src/agentConfig.ts
server/src/config.ts
server/src/app.ts
server/src/agent/askAnswer.ts
server/src/agent/chatModelFactory.ts
server/src/agent/classify.ts
server/scripts/startDevServer.ts
server/scripts/dev-server.ts
server/src/cookieCrypto.ts
server/src/providerKeyCheck.ts
server/src/schemas/connectRequestSchema.ts
server/src/__tests__/agentConfig.test.ts
server/src/__tests__/devServer.test.ts
server/src/__tests__/statusRoute.test.ts
server/src/__tests__/askRoute.test.ts
server/src/__tests__/config.test.ts
server/src/__tests__/connectRoute.test.ts
server/src/__tests__/cookieCrypto.test.ts
server/src/agent/__tests__/classify.test.ts

## Summary
The server no longer takes AI keys from visitors: it reads `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` from the environment through a new `getAgentConfig()`, and only when the local dev server set `COSMOS_LOCAL_AGENT=1` and `VERCEL` is unset. `GET /ai/status` returns `200 { connected: true, provider }` or `503 { errorCode: AI_NOT_LOCAL | AI_NOT_CONFIGURED }` without pinging the provider, `POST /ai/ask` uses the same check, and the cookie routes, cookie crypto, connect schema, provider key check and every `AI_COOKIE_SECRET` read are gone. The dev server now binds `127.0.0.1` via an exported `startDevServer` helper that sets the local flag after loading env files.
Results: `pnpm typecheck` pass (server + client); `pnpm lint` 0 errors (1 pre-existing warning in `client/src/map/Map.tsx`); server vitest 28 files / 339 tests passed; `pnpm build` pass; `grep -r AI_COOKIE_SECRET server/src` returns nothing.

## Commit message
feat(server): read AI keys from local env instead of a visitor cookie

The agent now runs only on the local dev server, keyed from server env,
so no visitor key is collected and no deployed host can turn it on.
Status and ask report AI_NOT_LOCAL / AI_NOT_CONFIGURED as 503 codes.

## Key decisions
- `AgentConfig` lives in `server/src/agentConfig.ts`: `{ provider: AiProvider; apiKey: string; gatewayApiKey: string | null }`. Also exports `getAgentConfig(): AgentConfigResult`, `AI_NOT_LOCAL`, `AI_NOT_CONFIGURED`, `AgentUnavailableReason`. Log-once INFO codes: `AI_DISABLED_NOT_LOCAL`, `AI_PROVIDER_BOTH_SET`. `AI_NOT_CONFIGURED` is not logged (spec doesn't ask for it).
- `config.ts` now holds only `getGatewayApiKey()`; `getAgentConfig()` uses it for `gatewayApiKey`.
- `startDevServer` is in `server/scripts/startDevServer.ts`: `startDevServer({ envFiles: string[]; serveApp?: typeof serve }): Promise<ServerType>`, plus exported `DEV_SERVER_PORT = 8787` and `DEV_SERVER_HOSTNAME = '127.0.0.1'`. `dev-server.ts` just calls it with the two env-file paths. The flag is assigned after `loadEnvFile`, so any file value is overwritten (equivalent to delete-then-set). Its test sits at the plan's path `server/src/__tests__/devServer.test.ts` and imports `../../scripts/startDevServer.js`.
- `classifyQuestion(question, snapshot, gatewayApiKey: string | null = getGatewayApiKey())`: the "visitor gateway key" concept is gone. `askAnswer` passes `config.gatewayApiKey` explicitly (null ⇒ local keyword fallback). The JEV failure warning no longer names a key source. `classify.test.ts` updated to match.
- `createChatModel` takes `Pick<AgentConfig, 'provider' | 'apiKey'>`; `answerQuestion` input field renamed `payload` → `config`.
- Deleted `server/src/providerKeyCheck.ts` (beyond the brief's explicit list): its only callers were `/ai/connect` and the old status check, and the plan says status no longer pings the provider, so it was dead code.
- No shared API type changed, so `pnpm types:emit` was not needed and no client file was touched. The client still calls `/ai/connect` / `/ai/disconnect`; both now 404 (accepted interim, stage 2). Client code that mentions `AI_NOT_CONFIGURED` is untouched.
- Left for later stages per brief: `.env.example`, `scripts/fresh-start.mjs`, README `AI_COOKIE_SECRET` mentions (stage 3); `offTopicAnswers.ts` (stage 4).
