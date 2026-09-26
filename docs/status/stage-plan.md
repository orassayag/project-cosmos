# Master Stage Plan
Plan: docs/plans/add-ai.md
Branch: feature/add-ai
Review budget: 120 minutes
Generated: 2026-09-26T00:00:00Z

## Scope estimate
~2600 hand-written LOC across ~50 files (plus ~86 zero-LOC `git mv` renames and one generated
snapshot JSON) → 20 stages at ≤250 LOC / ≤6 files each. The per-stage ceilings, not the
120-minute budget, set the count; expect this to span multiple sittings.

## Stages
- Stage 1: COMMITTED — M0: git mv Vite app into client/ + npm workspaces root, client/package.json, vite versions path, .gitignore ⚠ oversized by file count (~86 pure renames), cannot split further
- Stage 2: COMMITTED — M0: repoint drift-sync (imports, WRITABLE_PATHS, prompts, tsconfig, README) + scripts/fresh-start.mjs to client/src
- Stage 3: COMMITTED — M0: server/ workspace skeleton + snapshot-map.ts + committed cosmos-map.json + validate freshness check + apply-edits snapshot hook ⚠ generated JSON oversized, cannot split further
- Stage 4: COMMITTED — M0: repoint skills (.claude/skills + skills/ add-service, add-scenario) to client/src
- Stage 5: COMMITTED — M0: repoint CLAUDE.md, README, CONTRIBUTING, cosmos-sync.yml; run the M0 verification gate (grep, build/lint/validate, corruption proof, sync dry-run, 390px + desktop screenshots)
- Stage 6: COMMITTED — Hosting: vercel.json Services, Pages redirect page + pages.yml, server/.env.example, README "Run with AI locally"
- Stage 7: COMMITTED — Vitest harness in client + server, root test fan-out, CI npm test step
- Stage 8: COMMITTED — M1: shared .lc-status-dot, useAiConnection hook, AskAgent (Search, bot light, Connect/Disconnect) + AskAgent.test
- Stage 9: COMMITTED — M1: ConnectAgentModal + OVERLAY.connect registration + responsive.css priority + ConnectAgentModal.test
- Stage 10: COMMITTED — M1: AskPanel connect prompt under joke answers + starter question chips
- Stage 11: COMMITTED — M2: Hono app, config (AI_NOT_CONFIGURED), structured logger, cookieCrypto + cookieCrypto.test
- Stage 12: COMMITTED — M2: connect / disconnect / status routes + ConnectRequestSchema + key check + route/config tests
- Stage 13: COMMITTED — §5: route.ts decision, localRelevance, OFF_TOPIC_ANSWERS + route/localRelevance tests
- Stage 14: COMMITTED — §5: classify.ts (JEV evaluate, 3s timeout, fallback, warn-once) + classify.test
- Stage 15: COMMITTED — M3: context digest, systemPrompt, models, providerErrors + context/providerErrors tests
- Stage 16: COMMITTED — M3: LangGraph graph + highlight_services / play_scenario tools + graph.test
- Stage 17: COMMITTED — §7: POST /api/ai/ask NDJSON stream (classify → off-topic / direct / agent, usage, errors)
- Stage 18: COMMITTED — M3 client: computeAskTouches extract, Map askFocusIds, App action wiring (highlight + playScenario) + askTouches.test
- Stage 19: COMMITTED — §7 client: AskPanel stream reader, usage line, error messages, INVALID_KEY disconnect + AskPanel.test
- Stage 20: COMMITTED — Final acceptance: /test + preview-deploy end-to-end at 390px then desktop
