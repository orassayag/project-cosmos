# Stage 5 work brief — useAgentChat hook: in-flight ownership, stop marker, new-chat abort, errors + token usage, askStream { messages } (plan §2.4)

Plan: docs/plans/ai-refactor.md. Branch: feature/ai-refactor.

## Scope boundary for this stage
- Build the chat-state hook `client/src/hooks/useAgentChat.ts` and its unit tests, plus any change to `client/src/components/askStream.ts` the hook needs (abort signal, per-request id, usage/error surfacing).
- Do NOT build the `AgentChat` panel, the phone sheet / desktop dock, Stop/New-chat buttons, thinking dots, counter, or follow-up chips — that is stage 6. Do NOT touch demo scripted turns — that is stage 7.
- Wiring the hook into `App.tsx` is stage 6's job (it creates the panel that renders it). Leave the existing single-question AskPanel working as-is unless a shared helper extraction is genuinely required; if you change it, keep its tests green.
- No server change is expected (the server already accepts `{ messages }` and passes aborts on — stage 4).

## Plan section (verbatim)

#### 2.4 Chat state: `useAgentChat` (I3, I6, I7)
- `client/src/hooks/useAgentChat.ts`, owned by `App.tsx`, holds the messages **and the
  in-flight request** (its `AbortController`, streaming flag, partial reply). `AgentChat` only
  renders this state, so unmounting the window never aborts or loses a reply (I6).
- `send(question)` builds the request with `toRequestMessages` (2.1) and streams via
  `askStream.ts` (posts `{ messages }`). Map actions emitted mid-stream still run through
  `onAskAction`.
- `stop()` aborts the fetch; the server already passes the abort on. The partial reply is kept
  and marked `stopped: true`. When it goes into later requests, its content is
  `${partial}\n\n(reply stopped by the visitor)`, or just `(reply stopped by the visitor)` if it
  was empty. So it is never empty, roles still alternate, and the agent knows the reply was cut
  short (I3).
- `newChat()` calls `stop()` first, then clears the messages, so a late chunk can never land in
  the fresh chat (I6). Chunks are tagged with a per-request id, and chunks from an older id are
  dropped.
- **Errors and cost (I7):** a failed request appends an `error` message whose text comes from
  the existing `providerErrors.ts` mapping (e.g. "The AI provider refused the key in
  server/.env"), with a retry action. A finished reply stores its token usage, shown under the
  reply in small text (`1,240 tokens`), as the old panel did. Error messages are never sent back
  to the server.
- Verify: `client/src/hooks/__tests__/useAgentChat.test.ts` (new, unit, faked stream). Protects:
  - Stop before the first chunk, then ask again → the request is valid and contains the marker.
  - New chat during a stream → the abort is called and no late chunk appears.
  - Unmount mid-stream → the reply completes in state.
  - A 401 → an error message with the provider text, and the bot stays green.
  - Usage is stored per reply.


## Related plan context (verbatim)
- Issue I3: A stopped reply is sent with a short "stopped" note, so it is never empty and turns still alternate.
- Issue I6: The shared chat memory owns the running answer. New chat stops it first; closing the window does not.
- Issue I7: Errors appear as chat messages and token counts under replies. The old "disconnect on a bad key" code is removed.
- Known accepted gap: A bad key is found on the first question, not by the status check. The bot stays green until then, but the error is shown plainly in the chat (I7).
- Out of scope: keeping the chat after a page reload (memory only).
- §2.1: client trimming lives in `client/src/api/chatHistory.ts` (`toRequestMessages(history, question)`, already built in stage 4) — reuse it, don't re-implement.
- §2.3: Client `onAskAction` handles only the seven map action types; unknown types are ignored and logged at WARN (already in askStream.ts / App.tsx from stage 4).
