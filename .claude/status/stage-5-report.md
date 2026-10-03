## Files
client/src/hooks/useAgentChat.ts
client/src/hooks/__tests__/useAgentChat.test.ts
client/src/components/askStream.ts

## Summary
- New `useAgentChat({ onAction? })` hook in `client/src/hooks/useAgentChat.ts`. It returns `{ messages, isStreaming, send, stop, newChat, retry }` and owns the in-flight request: the `AbortController`, the streaming flag and the partial reply. The chat window will only render this state, so closing it never aborts or loses a reply (I6).
- `send(question)` trims the question and ignores a blank one. It stops any running reply first, then builds the request with the existing `toRequestMessages` and streams it. Map actions from the stream go to `onAction`.
- `stop()` aborts the fetch and keeps the partial reply as `status: 'stopped'`. When that reply goes into a later request, it is sent as `${partial}\n\n(reply stopped by the visitor)`, or just the note when nothing had arrived yet. So it is never empty and turns still alternate (I3).
- `newChat()` calls `stop()` and then clears the chat. Each request gets an id, and any event from an older id is dropped, so a late chunk can never land in the new chat.
- Errors (I7): a failed request adds an `error` message with the provider text from `toAskErrorMessage`. `retry(errorMessageId)` removes the failed question and its error, then asks the question again. Error messages and failed replies are never sent back to the server. A finished reply stores its own `usage` (`{ inputTokens, outputTokens }`).
- `askStream.ts`: new `streamAskMessages(messages, signal, onEvent)` posts `{ messages }`. The existing `streamAskAnswer(question, …)` now wraps it, so the current AskPanel behaves exactly as before and nothing in `App.tsx` changed.
- Tests: 8 in `useAgentChat.test.ts`, using a fake controllable streaming `fetch`. They cover a stop before the first chunk followed by a new question (the request is valid and carries the note), the note after a partial reply, new chat during a stream (abort called, no late chunk), a real child window unmounting mid-stream (the reply finishes in state and nothing is aborted), a 401 `INVALID_KEY` (error message with the provider text while `useAiConnection` stays `connected`), retry without sending the error back, and usage stored per reply plus action relay and history in the next request.
- Checks: `pnpm typecheck` passes. `pnpm lint` shows 0 errors and 1 warning that was already there (`client/src/map/Map.tsx:834`). Client `pnpm test` passes 277/277 (269 plus 8 new). `pnpm build` passes.
- Not wired into the UI (that is stage 6). Not checked in a browser with a real key. Demos were not re-recorded because no demo behaviour changed.

## Commit message
feat(client): add useAgentChat hook that owns the running chat reply

The coming chat window needs chat memory that outlives the window: stopping, starting a new chat and errors all have to stay consistent with what the server accepts.
The hook keeps the running request, sends a stopped reply back with a short note so turns alternate, drops late chunks after a new chat, and shows provider errors as chat messages.

## Key decisions
- **Where provider error text lives.** There is no `providerErrors.ts`. The mapping is `ASK_ERROR_MESSAGES` / `toAskErrorMessage` in `client/src/components/askStream.ts`, and the hook reuses it.
- **Message shape.** `AgentChatMessage` is one of three types. `AgentUserMessage` is `{ id, role: 'user', content }`. `AgentReplyMessage` is `{ id, role: 'assistant', content, status: 'streaming'|'done'|'stopped'|'failed', usage: TokenUsage | null }`. `AgentErrorMessage` is `{ id, role: 'error', errorCode, content, question }`. Ids are `chat-N` strings from a counter. The token count text is left to the UI (stage 6 can use the existing `formatUsage`).
- **`toChatHistory(messages)` is exported.** It is the only mapping from chat state to `ChatMessage[]`: it skips error messages and `failed`/`streaming` replies and adds the note to `stopped` replies. `toRequestMessages` then applies the server limits. `STOPPED_REPLY_NOTE` is exported too.
- **An error after part of a reply.** If tokens had already arrived, the partial reply stays visible as `status: 'failed'` and is never sent back. An empty placeholder reply is removed. Either way, the unanswered question is dropped from the next request by `toRequestMessages` (two user turns in a row).
- **`send` while a reply is still running** stops it first rather than ignoring the new question. The stopped reply then goes into the new request with the note. Stage 6 can still disable sending while streaming if it wants to.
- **Sync state mirror.** Messages are kept in a ref as well as React state, so that `stop()` followed by `send()` in the same tick (and `retry`) read the latest history.
- **Abort on unmount.** The hook aborts its request only when the hook itself unmounts, which means when `App` unmounts. Closing the chat window never does.
- **`askStream.ts` change kept small.** Instead of a new module, `streamAskMessages` was added beside `streamAskAnswer`, and the per-request id check lives in the hook. `streamAskMessages` already emits nothing after an abort.
- No `onAnswerStart` equivalent was added. Stage 6 can tell when an answer starts from `status === 'streaming' && content !== ''`.
