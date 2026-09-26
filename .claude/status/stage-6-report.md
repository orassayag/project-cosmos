# Stage 6 report — §5: AskPanel `scriptedAnswer`

## Files
client/src/components/AskPanel.tsx
client/src/components/__tests__/AskPanel.test.tsx

## Summary
The answer panel can now play a fixed, pre-written answer for the demo. When the new `scriptedAnswer` setting is given, the panel shows the "thinking" dots for exactly the given time, then reveals the text one word at a time at a fixed pace, and fires the map actions (such as highlighting services) the moment the answer starts. In this mode it never contacts the AI server, never shows the joke answer, and never shows the "Connect an AI agent" prompt. Without the setting, the panel behaves exactly as before.

Two new tests: one checks the exact text appears after thinking time + words × word pace, the highlight fires once as the answer starts, no Connect prompt appears, and `fetch` is never called (even with `isAiConnected` set). The other checks that closing the panel mid-answer cancels every pending timer.

Checks: `npm run typecheck` clean; `npm run lint` 0 errors (1 pre-existing warning in `client/src/map/Map.tsx`, untouched); client tests 85/85 pass (AskPanel 8/8); `npm run build` succeeds.

## Commit message
feat(demo): let the answer panel play a scripted answer

The demo needs the same AstroMart answer every run, with no joke and no
AI server call. A `scriptedAnswer` prop plays fixed text at fixed timing
and fires its map actions as the answer starts; normal visitors are unchanged.

## Key decisions
- `DemoScriptedAnswer` in `client/src/demo/types.ts` already had `actions?: AskAction[]`; reused as-is, no change to that file.
- Scripted mode = `scriptedAnswer !== undefined`. It overrides the live path too (`isLive` is false when scripted), so no request is made even if `isAiConnected` is true.
- Timing comes only from the prop (`thinkingMs`, `wordMs`); all timeouts are scheduled up front (word N at `thinkingMs + N × wordMs`, done at `thinkingMs + words × wordMs`) and cleared on unmount or when `scriptedAnswer` changes.
- `onAnswerStart` and every action fire once, together, at `thinkingMs`.
- The effect is keyed on the `scriptedAnswer` object identity: stage 8 must keep it referentially stable (store it in state, not an inline literal), or each re-render restarts the answer.

## Open questions
None.
