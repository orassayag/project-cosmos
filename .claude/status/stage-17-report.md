# Stage 17 report — §7: POST /api/ai/ask NDJSON stream

## Files
server/src/app.ts
server/src/agent/askAnswer.ts
server/src/schemas/askRequestSchema.ts
server/src/__tests__/askRoute.test.ts
server/src/__tests__/config.test.ts

## Summary
`POST /api/ai/ask` now streams an answer as `application/x-ndjson`. The checks run in this order:
1. No `AI_COOKIE_SECRET` returns 503 `AI_NOT_CONFIGURED`.
2. No valid cookie returns 401 `NOT_CONNECTED`. This happens before the body is read and before JEV is called. A tampered cookie is cleared.
3. A bad body returns 400 `INVALID_REQUEST`, using the same `field`/`message` shape as connect.

After that, `answerQuestion` classifies the question and routes it:
- **Off-topic:** a `token` line, then `done`.
- **Direct action:** a `token` line, a `playScenario` action, then `done`.
- **Agent:** the `streamAgentAnswer` events are relayed as they are, then `done`.

A `ProviderError` becomes an `error` line followed by `done`. An aborted request writes nothing more and logs nothing. There are no client changes.

Hand-written files: 5, within the ceiling of 6. About 370 LOC, which is over the 250 ceiling. Roughly 210 of those are tests (`askRoute.test.ts` 197, `config.test.ts` +12). Production code is about 160 LOC (app.ts net +96, askAnswer 53, schema 14).

| Gate (repo root) | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass: 0 errors, the 2 warnings that were already there (AskPanel.tsx, Map.tsx) |
| `npm test` | pass: client 12/12, server 95/95 (10 new: askRoute 9, config 1) |
| `npm run build` | pass |
| `npm run validate` | pass, no drift |

Proof that the tests catch real breakage. Each mutation was applied from a scratchpad backup, run, restored, and `diff -q` confirmed the restore. Everything was green again afterwards.
- M1: the off-topic branch calls `createChatModel(payload)` → the off-topic test fails.
- M2: the `signal.aborted` check in the catch is removed → the abort test fails.
- M3: the stream returns right after the `error` line, so no `done` → the ProviderError test fails.
- M4: the errorCode is hard-coded to `PROVIDER_ERROR` → the ProviderError test fails.
- M5: the direct-action branch does not yield its `playScenario` action → the direct-action test fails.
- M6: `readAiCookie` does not clear a cookie it cannot decrypt → the ask tamper test and the status "fails to decrypt" test both fail.
- M7: the `application/x-ndjson` Content-Type header is dropped → the off-topic test fails.

## Commit message
feat(server): stream /api/ai/ask answers as NDJSON

Wires classification, routing and the LangGraph agent behind one streamed route. The
cookie is checked before JEV so the owner's gateway key is only spent on connected
visitors, and off-topic or direct-action replies never build the visitor's model.

## Key decisions
- **Protocol:** every stream that is not aborted ends with exactly one `{"type":"done"}`, and that includes after an `{"type":"error","errorCode":…}` line. Clients get one terminal signal and treat `error` as the outcome. An aborted request writes nothing after the abort and does not log. `streamAgentAnswer` reports an abort as `PROVIDER_ERROR`, so `signal.aborted` is checked to tell the two apart.
- **Signal:** the stream uses `AbortSignal.any([request signal, stream-abort signal])`, and it is passed to `streamAgentAnswer`. The second signal fires when Hono's response stream is cancelled, which is how a client disconnect shows up on Node.
- **Streaming helper:** Hono's `stream()` from `hono/streaming`, with `Content-Type: application/x-ndjson` and `Cache-Control: no-store`. Its `onError` is set so nothing ever reaches Hono's default `console.error(e)`. That handler logs `INTERNAL_ERROR` and writes an error line. It should never fire, because `answerQuestion` catches everything itself.
- **Logic split:** the event logic lives in `server/src/agent/askAnswer.ts` (`answerQuestion({ question, payload, snapshot, signal }): AsyncGenerator<AskStreamEvent>`, exporting the `AskStreamEvent`, `ErrorEvent` and `DoneEvent` types). The route in `app.ts` only does the guards and writes `JSON.stringify(event) + '\n'`. Anything that is not a `ProviderError` is mapped with `toProviderError`, so it becomes `PROVIDER_ERROR`.
- **Log levels:** `PROVIDER_ERROR` logs at error. `OUT_OF_CREDIT`, `RATE_LIMITED` and `INVALID_KEY` log at warn, because they are problems with the visitor's account, not bugs. Every log carries only `{ errorCode, provider, noPHI: true }`, and the test asserts that the key never appears in console output.
- **Tidying in `app.ts` (Boy Scout):**
  - The JSON-body/Zod validation moved from connect into a shared `validateJsonBody(context, schema)`.
  - The cookie read/decrypt/clear-on-tamper moved from status into a shared `readAiCookie(context, secret)`.
  - Connect, status and ask all use them. Response shapes did not change, and the existing tests still pass.
- **`AskRequestSchema`** is in `server/src/schemas/askRequestSchema.ts`: `question` is trimmed, cannot be empty, and has a maximum of 500 characters. A failure returns `400 { errorCode:'INVALID_REQUEST', field:'question', message }`. Invalid JSON returns `field:'body'`.
- **Direct-action text:** sent exactly as `decideRoute` returns it, `Playing *<title>* for you ▶`, with the asterisks. Rendering or stripping them is the client's job (stage 19).

## Open questions
- The LOC ceiling is exceeded (about 370 against 250), mostly because of tests. Accept it, or trim the test file?
- A live streaming smoke test (`vercel dev -L`, a real client disconnect aborting the agent) was not run, because it needs a real provider key and gateway. Carry-overs from earlier stages are unchanged: the `AI_PROVIDERS` move out of `logger.ts`, the `vercel env pull` smoke, the `useAiConnection` unit test, and root `"dev": "vercel dev"`.
