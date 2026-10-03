# Stage 7 report — Demos answer from scripted turns

## Files
server/src/cosmos/data/demo.ts
server/src/cosmos/apiTypes.ts
server/src/cosmos/schema.ts
server/src/cosmos/validate.ts
server/src/__tests__/demoData.test.ts
server/src/__tests__/validateCosmos.test.ts
server/src/__tests__/agentEval.test.ts
scripts/fresh-start.mjs
client/src/api/cosmos-api.ts
client/src/__tests__/fixtures/cosmos-response.json
client/src/hooks/useAgentChat.ts
client/src/components/AgentChat.tsx
client/src/components/AgentButton.tsx
client/src/App.tsx
client/src/demo/scriptedAnswer.ts
client/src/demo/scripts.ts
client/src/demo/types.ts
client/src/hooks/__tests__/useAgentChat.test.ts
client/src/components/__tests__/AgentChat.test.tsx
client/src/components/__tests__/DemoPointer.test.tsx
client/src/demo/__tests__/scriptedAnswer.test.ts
client/src/demo/__tests__/scripts.test.ts
client/src/demo/__tests__/demoTargets.test.tsx
client/src/demo/__tests__/runDemo.test.ts
client/src/demo/__tests__/useDemoRunner.test.ts
README.md
CLAUDE.md

## Summary
- Data: `aiTour` is now `{ domainId, turns, citedDriftEntryIds }`. Each turn is `{ question, scriptedAnswer: { text, thinkingMs, wordMs }, actions, followUps }`. There are 2 turns. Turn 1: "What changed in the Fulfillment Galaxy over the past 24 hours?" It highlights shipping, notifications and orders, opens the shipping passport, and offers the chip "Who owns shipping?". Turn 2 answers that question with the Fulfillment team and its on-call, and highlights the team's four services. All data stays fictional (AstroMart).
- Schema: `DemoMapAction` (the same 7 action shapes the agent streams) and `DemoAiTurn` are in `apiTypes.ts`, with matching strict zod schemas. Ran `pnpm types:emit` and `pnpm fixture:cosmos`.
- Validator: it checks every id in the turn actions (highlight → service, playScenario → scenario, passport/blast → service or topic, changelog → drift entry). It reports `unknown-demo-reference` with `field: aiTour.turns.N.actions.<kind>`. A new `demo-follow-up-mismatch` error fires when `turns[i].followUps[0]` is not exactly `turns[i+1].question`, and names the turn and both strings.
- `useAgentChat({ onAction, scriptedTurns })`: while `scriptedTurns` is set, `send` never calls the server. It finds the turn with the exact question and plays its answer with the old timing (thinking pause, then one word per `wordMs`). It runs the turn's actions through `onAction` after the pause, and stores the turn's `followUps` on the finished reply. An unknown question gets the fixed reply "This demo only knows its scripted questions." with no chips. Stop and New chat still work. `sendScripted` is removed.
- `AgentChat`: a reply that carries `followUps` shows exactly those chips. Otherwise it still uses `suggestFollowUps`. The first follow-up chip has `data-demo-target="agent-followup-0"`.
- App: the `handleAsk` demo branch is gone. App passes `scriptedTurns` only while the demo runs.
- Scripts: both tours click `agent-button`, then click and type in `agent-composer`, then click `agent-send`, wait out the answer, tap `agent-followup-0` and wait out the second answer. There are no Connect or paste-key steps. Targets renamed: `connect-open` → `agent-button`, `ask-input` → `agent-composer`, `ask-search` → `agent-send`.
- Checks: `pnpm typecheck` passes. `pnpm lint` has 0 errors and 1 old warning (`client/src/map/Map.tsx:836`). `pnpm test` passes: server 369, client 304, scripts 11. `pnpm build` passes. `pnpm validate` shows 0 errors.
- Re-recorded both demos (`BASE_URL=http://localhost:5198 pnpm record:demo ai|all`, my own Vite on 5198 against the running API dev server): `demo=ai` finished in 26.5s (limit 60s) and `demo=all` in 116.3s (limit 120s). I looked at Playwright screenshots of `?demo=ai` at 1440×900, 390×844 and 844×390. Both turns, the chip tap and the highlights look right.
- `fixtures/baseline-full.json` has no demo data, so it did not need a change.

## Commit message
feat(demo): answer the demo chat from scripted turns with follow-up chips

The live site has no AI key, so the demos need their own answers in the new chat.
Each scripted turn carries its answer, map actions and follow-up chips, and the
validator makes sure the tapped chip always asks the next scripted question.

## Key decisions
- **27 files, over the 10-file ceiling.** The extra files are mechanical: three runner/pointer tests that only renamed the demo targets, the generated fixture and emitted types, and `scripts/fresh-start.mjs`, which writes a `demo.ts` and would otherwise produce data that fails the new schema.
- **The second turn highlights the team rather than opening the ownership view.** My first version used `showOwnership`. On desktop the ownership legend then drew on top of the shipping passport opened in turn 1. Two panels overlapped, which breaks the one-panel rule. The overlap is not new: a real agent answer that does both would show it too. I noted it under Open questions.
- **On phones only the highlight actions run.** `buildDemoScriptedTurns(aiTour, { isPhone })` drops every action that opens a surface (passport, legend, changelog, scenario). On a phone that surface would cover the chat while it answers. This keeps the old phone rule, which left out the passport, and applies it to all surface actions.
- **Scripted mode is chosen by App with `isDemoActive`.** That is the same flag that swaps in `useDemoAiConnection`. I did not add a separate demo flag to `AiConnection`. `useDemoAiConnection` itself is unchanged.
- **`followUps` is an optional field on `AgentReplyMessage`.** If it is set, the chat shows exactly those chips, even an empty list. If not, it suggests its own. Scripted replies have `usage: null`, so no token count shows.
- **The demo taps the chip once for each later turn.** This is generic for 2–3 turns. Each answer wait adds 400ms so the chip can render before the pointer moves to it.
- **`DemoMapAction` copies the server's `MapActionEvent`.** It is not imported from it, because `apiTypes.ts` is the emitted contract and `mapActionTools.ts` is out of scope. If a new action kind is added, both need it.
- `scriptedAnswerDurationMs` moved from `scripts.ts` to `scriptedAnswer.ts`. It sits next to the word splitter that `useAgentChat` uses, so the script waits and the playback timing cannot drift apart. `DemoScriptedAnswer` was removed.
- README (Demo tours) and the CLAUDE.md demo notes were updated: they named `DEMO_SCRIPTED_ANSWER`, `handleAsk` and fake keys, which no longer exist.

## Open questions
- `demo=all` now runs 116.3s against its 120s limit, so it has little room left. Stage 8 or a later feature added to `demo=all` will need to trim another segment.
- Not fixed, outside scope: on desktop, a map legend (for example the ownership legend) can draw over an open passport/inspector card in the top-left. The demo no longer triggers it, but a real agent answer that opens a passport and then runs `showOwnership` would.
