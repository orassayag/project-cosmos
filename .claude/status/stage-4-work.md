# Stage 4 work brief — Chat request contract + client trimming, follow-up-aware routing, fixed off-topic reply, 13-tool allow-list (plan §2.1, §2.2, §2.3)

Plan: docs/plans/ai-refactor.md. Spec: none.

## Plan context (Summary)
## Summary
Turn "Ask the Agent" from a single-question panel that asks visitors for API keys into a
multi-turn chat that needs no keys. The server reads the model keys from its own `server/.env`,
and only when the owner runs it on their own machine: the dev server listens on loopback only,
and the agent is switched on only by the local dev script. The ask inputs at the top of the
page go away. A bot button sits bottom-right and stays red (not connected) or green (connected).
Red opens a window that explains how to set up the agent and JEV locally, with wording based on
why it is red. Green opens a right-side chat. The agent can only look at the map and show things
on it, never change saved state, and its errors and token use appear right in the chat.

Both scripted demos show a connected agent holding a short conversation. They answer from
scripted turns on the client, so the live site needs no AI key. This plan is a second review
round. The decisions from the first round are built into `## Design`, and the issue IDs below
are from this round.

## Plan sections for this stage (verbatim)
#### 2.1 Chat request contract (I4)
- One limit, counted in messages: `CHAT_MAX_MESSAGES = 20`.
- `server/src/schemas/askRequestSchema.ts`:
  ```ts
  ChatMessageSchema = z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) })
  AskRequestSchema  = z.strictObject({ messages: z.array(ChatMessageSchema).min(1).max(CHAT_MAX_MESSAGES) })
  ```
  plus refinements, each with a field-named error: the first and last messages are `user`;
  roles alternate; total characters ≤ `CHAT_TOTAL_MAX_CHARS = 8000`; the newest user message
  keeps the existing 500-char limit. The server **rejects** anything longer and never trims
  it. Strict objects reject `system`, `tool` and tool-call fields.
- **Client trimming** (`client/src/api/chatHistory.ts`, pure `toRequestMessages(history, question)`):
  takes the newest 19 messages plus the new question, then drops from the front until the first
  message is `user`, and then until total characters fit. So a long chat always sends a valid
  request, and the agent remembers "the last up-to-20 messages".
- Assistant turns from the client go to the model as plain `AIMessage` text, never as tool
  calls, so a crafted history cannot fake tool output.
- Verify:
  - `server/src/schemas/__tests__/askRequestSchema.test.ts` (new, unit). Protects: 21 messages
    rejected with `messages` named; starting with `assistant` rejected; `system`/`tool` roles,
    extra fields, non-alternating roles and over-length totals rejected.
  - `client/src/api/__tests__/chatHistory.test.ts` (new, unit). Protects: output is always ≤20,
    starts with `user`, alternates, and fits the character cap, for histories of 1–60 messages.
  - Route-level: `askRoute.test.ts` 400 cases name the field.

#### 2.2 Follow-up-aware routing
- `answerQuestion` receives `messages`. If `messages.length === 1`, classify it as today
  (`classifyQuestion` → `decideRoute`). Any later message skips classification and goes straight
  to the agent with the whole history: `graph.ts` seeds `state.messages` with the mapped history
  instead of a single `HumanMessage`.
- The first-message off-topic reply becomes one fixed, polite redirect with no random jokes:
  "I can only help with the AstroMart map — try asking about a service, a flow, or a team."
- Verify: `server/src/agent/__tests__/route.test.ts` + `classify.test.ts` (extend, unit).
  Protects: follow-ups are never classified and never get the off-topic reply.
  `graph.test.ts` (extend). Protects: history reaches the model in order.

#### 2.3 Allowed agent actions
- The agent's tool set is exactly, and only:
  - Map actions (`mapActionTools.ts`): `highlight_services`, `play_scenario`,
    `show_blast_radius`, `open_passport`, `show_health`, `show_ownership`, `open_changelog_entry`.
  - Read tools (`readTools.ts`): `get_service`, `get_steps`, `blast_radius`, `who_owns`,
    `on_call`, `drift`.
- Explicitly excluded: layout edit mode, layout reset, starting a demo, and anything that writes
  `localStorage`, cookies, or server data. No new tools in this plan.
- Export `AGENT_TOOL_NAMES` from `graph.ts`. Client `onAskAction` handles only the seven map
  action types; unknown types are ignored and logged at WARN.
- Verify: `server/src/agent/__tests__/graph.test.ts` (extend, unit). Protects: the bound tool
  names match the 13-name allow-list exactly, so adding a tool fails the test until the list is
  reviewed. `client/src/__tests__/askMapActions.test.tsx` (extend). Protects: no action touches
  layout storage.


## Orchestrator notes (scope boundaries for this stage)
- Out of scope here (later stages): `useAgentChat` hook, stop marker, new-chat abort (stage 5, §2.4); the chat panel UI (stage 6); scripted demo turns (stage 7); Playwright (stage 8).
- **Keep the app working between stages.** Once the server accepts only `{ messages }`, the current client (`client/src/api/askStream.ts`, which today sends a single question) would get 400s. Make the minimal client change so the existing single-question AskPanel still works: send `{ messages: toRequestMessages([], question) }` (or the equivalent shape). Stage 5 owns the full `askStream { messages }` API and history wiring — do not build the hook or history state now.
- If a shared API type changes (`server/src/cosmos/apiTypes.ts`), run `pnpm types:emit` so `client/src/api/cosmos-api.ts` stays in sync (CI fails on a stale copy). Never hand-edit `cosmos-api.ts`.
- The off-topic joke answers (`offTopicAnswers.ts` per the stage-1 ledger) and any random-star fallback are removed in favour of the single fixed redirect string. Update the README line that still mentions the "canned playful reply" (stage 3 left it for this stage).
- `client onAskAction`: only the seven map-action types; unknown types ignored + WARN via the project's logger (never `console.*` unless that is the established client pattern — check first).
- Validation errors must name the field (project error-handling rule).
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test` (and `pnpm build`) before reporting. Never run `tsc` without `--noEmit`/`-b`.
