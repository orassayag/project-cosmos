## Files
server/src/schemas/askRequestSchema.ts
server/src/schemas/__tests__/askRequestSchema.test.ts
server/src/app.ts
server/src/agent/askAnswer.ts
server/src/agent/graph.ts
server/src/agent/route.ts
server/src/agent/offTopicAnswers.ts
server/src/agent/__tests__/graph.test.ts
server/src/agent/__tests__/route.test.ts
server/src/agent/__tests__/classify.test.ts
server/src/__tests__/askRoute.test.ts
server/src/__tests__/agentEval.test.ts
client/src/api/chatHistory.ts
client/src/api/__tests__/chatHistory.test.ts
client/src/components/askStream.ts
client/src/App.tsx
client/src/__tests__/askMapActions.test.tsx
client/src/__tests__/askUnknownAction.test.ts
client/src/components/__tests__/AskPanel.test.tsx
README.md

## Summary
- `POST /api/ai/ask` now takes only `{ messages: [{ role, content }] }`. The schema is strict (no `system`/`tool` roles, no extra fields, no tool-call fields), holds 1–20 messages, must start and end with the user, must alternate, totals at most 8,000 characters, caps each message at 2,000 and the newest question at 500. Every 400 names the field (for example `messages`, `messages.0.role`, `messages.2.content`). The server rejects; it never trims.
- Only a chat's first message is classified. Any follow-up goes straight to the agent with the whole history and no hints, so it can never get the off-topic reply.
- The graph seeds its state with the mapped history. User turns become `HumanMessage`, assistant turns become plain-text `AIMessage` with no tool calls.
- Off-topic questions now get one fixed reply: "I can only help with the AstroMart map — try asking about a service, a flow, or a team." The joke list (`offTopicAnswers.ts`) and the random pick are gone.
- `AGENT_TOOL_NAMES` (13 names) is exported from `graph.ts`. A test pins the bound tools to that list, and the list to the seven map actions plus the six read tools.
- New pure client helper `toRequestMessages(history, question)` in `client/src/api/chatHistory.ts`. The existing single-question AskPanel now sends `{ messages: toRequestMessages([], question) }`, so the app keeps working.
- Unknown agent action kinds are ignored and logged at WARN (`errorCode: 'UNKNOWN_ASK_ACTION'`). This happens both in the stream parser and in a `default` branch of `handleAskAction` in App.tsx.
- README: the off-topic line now describes the fixed redirect. Added a bullet on follow-ups and history limits, plus the 13-tool allow-list. The API table shows the request shape.
- Checks: `pnpm typecheck` clean. `pnpm lint` 0 errors, 1 pre-existing warning (`client/src/map/Map.tsx:834`). `pnpm test`: server 360/360, client 269/269, scripts 11/11. `pnpm build` passes.
- Not verified in a running browser with a real model key. Demos were not re-recorded, because no demo behaviour changed in this stage.

## Commit message
feat(agent): accept chat history and route follow-ups to the agent

The ask endpoint now takes a short, validated chat history instead of a single question, so the agent can answer follow-ups like "and who owns it?".
Only the first question is triaged. Off-topic questions get one polite fixed redirect, and the agent's tools are pinned to a reviewed 13-name allow-list.

## Key decisions
- **Error paths.** Refinement errors point at the exact message: first, last and alternation problems at `messages.N.role`, a long question at `messages.N.content`, and the total cap at `messages`. A body in the old `{ question }` shape gets 400 with `field: 'messages'`, because the missing field is reported first.
- **Limits in two places.** The client keeps its own copies of the limits (`CHAT_MAX_MESSAGES`, `CHAT_TOTAL_MAX_CHARS`, `CHAT_MESSAGE_MAX_LENGTH`) in `chatHistory.ts`, with a comment pointing at the server schema. `apiTypes.ts` holds only data types, so it was left alone and `types:emit` was not needed.
- **How `toRequestMessages` trims.** It walks back from the new question and stops at the first turn that breaks a rule: wrong role order, empty, over 2,000 characters, or past the total cap. It then drops from the front until the first message is from the user. This matches the brief ("newest 19 + question, drop from front"). It also means an unanswered earlier question (two user turns in a row) never produces an invalid request.
- **No client logger existed.** The client had no structured logger and no `console.*` use. So `warnUnknownAskAction` in `askStream.ts` writes one JSON `console.warn` line in the server's log shape (`level`, `scope`, `errorCode`, `noPHI`).
- **Where the follow-up test lives.** The check that follow-ups are never classified sits at the route level, in `askRoute.test.ts` (classifier mocked; asserts it is never called and the agent gets the full history). It is not in `classify.test.ts`, because the branching is in `answerQuestion`, not in `decideRoute` or `classifyQuestion`. `route.test.ts` and `classify.test.ts` were updated for the fixed reply and the removed pick-index parameter.
- **Layout-storage test.** The test spies on `Storage.prototype` set/remove/clear for all seven actions. `playScenario` needed jsdom stubs for `SVGElement.getTotalLength` and `getPointAtLength`.
- **Brief path vs. real path.** `askStream.ts` lives at `client/src/components/askStream.ts`, not `client/src/api/`. It was edited where it is.
