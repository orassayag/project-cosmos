# Stage 19 report — §7 client: AskPanel stream reader, usage line, error messages, INVALID_KEY disconnect

## Files
client/src/components/askStream.ts
client/src/components/AskPanel.tsx
client/src/App.tsx
client/src/styles/app.css
client/src/components/__tests__/AskPanel.test.tsx
client/src/components/__tests__/askStream.test.ts

## Summary
When an AI agent is connected, the Ask panel now shows the agent's real answer as it streams in. The fake word timer is no longer used in that case. When no agent is connected (or the status is still `unknown`), the canned joke, its typing effect, and the "Connect an AI agent for real answers." prompt work exactly as before.

**The stream logic** lives in a new pure module, `client/src/components/askStream.ts`:
- `parseAskStreamLine(line)` parses one NDJSON line. Blank, malformed or unknown lines return `null`, so one bad line cannot crash the panel.
- `readAskStream(body, onEvent)` keeps partial lines across chunks, so a line split between two chunks still arrives whole.
- `streamAskAnswer(question, signal, onEvent)` sends `POST /api/ai/ask` with `{ question }`. It turns non-2xx responses and network failures (including one mid-stream) into a single `error` event, then sends `done`. Every call that isn't aborted ends with exactly one `done`, and only the first `error` is passed on. After an abort it sends nothing.
- `toAskErrorMessage`, `formatUsage` and `splitEmphasis` handle the message table, the `≈ N tokens` text and the `*Title*` rendering.

**In the panel, each event does this:**
- `token`: the text is appended. The thinking dots show until the first token, and `onAnswerStart` fires once, on that first token.
- `action`: the parsed line is passed unchanged to `onAction`.
- `usage`: a muted `≈ 1,322 tokens` line appears under the answer once the stream is `done`. It is hidden when an error occurred.
- `error`: the mapped message shows in red with `role="alert"`. On `INVALID_KEY` or `NOT_CONNECTED`, the new `onKeyRejected` prop fires, once per stream.
- `done`: the stream is finished.

**App wiring:** `App` passes `isAiConnected` and `onKeyRejected={handleDisconnect}`. That handler is the existing `useAiConnection().disconnect()`; there is no parallel fetch. So an `INVALID_KEY` event makes exactly one `POST /api/ai/disconnect` call and the status light turns red. Because the status becomes `disconnected`, the existing Connect prompt then shows under the error.

**Aborting:** the in-flight request is aborted when the panel unmounts. That covers both closing the panel and asking a new question, since `App` re-keys the panel per ask. An aborted request shows no error.

**Emphasis:** `*Title*` and `**Title**` render as `<em>`, so no raw asterisks are shown. No markdown library was added.

**Boy Scout fix:** the fake-answer effect used to have the exhaustive-deps lint warning. It now reads its callbacks through a ref that is synced after each render, so the warning is gone.

Hand-written files: 6, within the ceiling of 6. Line counts: `AskPanel.tsx` 194, `askStream.ts` 161, `AskPanel.test.tsx` 168, `askStream.test.ts` 119. All are under 300. `App.tsx` gained 2 lines and `app.css` gained 15; both files were already over 300 lines.

| Gate (repo root) | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass: 0 errors, 1 warning (Map.tsx, already there). The AskPanel warning is gone. |
| `npm test` | pass: client 29/29 (12 new: 9 askStream, 3 AskPanel connected), server 95/95 |
| `npm run build` | pass |
| `npm run validate` | pass, no drift |

**Mutation proof:** a scratchpad `mutate.py` applied each mutation from a backup, ran the client tests, restored the file, and confirmed the restore with `diff -q`. All 9 were caught and all files were restored. The full suite was green again afterwards.
- M1: `INVALID_KEY` no longer calls `onKeyRejected` → the logout test fails.
- M2: `onKeyRejected` fires twice → the "exactly one disconnect" assertion fails.
- M3: `action` lines are not forwarded → the `onAction` test fails.
- M4: usage counts output tokens only → the `formatUsage` test and the AskPanel usage-line test fail.
- M5: the partial-chunk buffer is dropped → the chunk-reassembly test fails.
- M6: a malformed line throws → the parser test and the reader test fail.
- M7: the first-error-only guard is removed → the "only the first error" test fails.
- M8: raw `*Title*` is kept → the `splitEmphasis` test and the AskPanel `<em>` test fail.
- M9: a non-2xx `errorCode` is ignored → the `NOT_CONNECTED` test fails.

**Mobile:** checked with scratchpad Playwright against `vite --port 5199`, with `/api/ai/*` mocked, at 390×844, 844×390 and 1440×900. Two cases per viewport:
- a long streamed answer with `*Checkout*`, a highlight action and usage
- a token followed by `OUT_OF_CREDIT`

In all 6 runs the panel stayed inside the viewport, with no horizontal page or panel overflow. The usage and error lines sat inside the panel width. `<em>` rendered and no raw asterisk showed. On a 390px phone, a long answer puts the usage line in the panel's existing scroll area (`overflow-y: auto`). No new panel was added, so the close-button contract and the one-card-at-a-time rule are unaffected.

**Not verified:** there was no live streaming against a real provider or `vercel dev`, since that needs a real key; that is stage 20. The `App` → `handleAskAction` path (highlight glow, `playScenario` autoplay) is still only covered up to the `onAction` call. The browser check only confirmed the highlight action was received, not the glow.

## Commit message
feat(client): stream real agent answers into the Ask panel

A connected visitor still got the canned joke, and a key found dead mid-answer stayed
"connected" (round-2 I4). AskPanel now reads the /api/ai/ask NDJSON stream, shows
usage and mapped errors, and calls disconnect() once on INVALID_KEY.

## Key decisions
- **New AskPanel props:** `isAiConnected?: boolean` is read **once at mount**, so a status flip mid-answer, such as after `INVALID_KEY`, never swaps the live answer for the joke. `onKeyRejected?: () => void` fires on `INVALID_KEY` **and** on a pre-stream `401 NOT_CONNECTED`. `App` passes `handleDisconnect`, so the one `useAiConnection` instance flips to `disconnected`.
- **`client/src/components/askStream.ts` API:** it exports `AskStreamEvent`, `parseAskStreamLine`, `readAskStream`, `streamAskAnswer`, `ASK_ERROR_MESSAGES`, `DISCONNECTING_ERROR_CODES`, `toAskErrorMessage`, `formatUsage` (uses `Intl.NumberFormat('en-US')`) and `splitEmphasis`. `AskAction` stays exported from `AskPanel.tsx`; askStream imports it as a type only.
- **Client-only messages:** the brief left these to be minimal, so beyond the four §7 codes (whose text is verbatim) I chose:
  - `NOT_CONNECTED`: "Your AI agent is no longer connected — connect it again to ask."
  - `AI_NOT_CONFIGURED`: "AI answers aren't available on this site right now."
  - `INVALID_REQUEST`: "That question couldn't be sent — try a shorter one."
  - `NETWORK_ERROR`: "Couldn't reach the AI agent — check your connection and try again."
  - Any unknown code gets the `PROVIDER_ERROR` message.
- **The usage line only shows after `done` and only without an error.** Off-topic and direct-action replies carry no usage event, so they show nothing.
- **Callbacks go through a ref synced after each render.** This way the stream effect depends only on `[isLive, question]` and is not restarted when parent callbacks change. In dev StrictMode, the first run's request is aborted and emits nothing, so the logout still happens only once.

## Open questions
None blocking. As in stage 18, the `App` highlight/autoplay wiring has no automated test; the stage-20 acceptance steps 6 and 7 cover it end to end.
