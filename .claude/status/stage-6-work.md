# Stage 6 work brief — §5: AskPanel `scriptedAnswer`

Stage line: §5: AskPanel `scriptedAnswer` (fixed thinking/word pace, actions, no fetch, no joke) + AskPanel.test cases

Scope: `client/src/components/AskPanel.tsx`, its test `client/src/components/__tests__/AskPanel.test.tsx`
(create if missing). May reuse `DemoScriptedAnswer` from `client/src/demo/types.ts` (stage 1) —
align the prop type with it (add `actions?: AskAction[]` there if it is missing/mistyped).
Do NOT write `client/src/demo/scriptedAnswer.ts` or its test — that is stage 7.

## Plan text (verbatim, docs/plans/demo-plan.md)

### Summary (excerpt)
The demo is pure theatre on the client. It never calls the AI server, never uses a real key,
and looks the same in every browser.

Out of scope: Changing what normal visitors see. Without `?demo=`, every component behaves as it does today.

Issue I3: The "answer like today" is the joke answer that says there's no AI → Fixed: A fixed
AstroMart answer through a new `scriptedAnswer` prop, with fixed thinking time and word pace. Design §5.
Issue I5: The demo breaks, or spends a real key, when the real AI status isn't "disconnected" →
A local fake connection replaces the real one, and the real hook is disabled. No `/api/ai/*` calls.

### §5 — Question and scripted answer (I3, I4)

- `AskPanel` gets an optional `scriptedAnswer?: { text: string; thinkingMs: number; wordMs:
  number; actions?: AskAction[] }`. When it is set, the panel plays that text with fixed timing
  (thinking 1500ms, 90ms per word) and fires `actions` when the answer starts. The joke list and
  the connect prompt are skipped, and no request is made. The joke list is untouched for normal
  visitors.
- Tests:
  - `AskPanel.test.tsx`: `scriptedAnswer` renders the exact text after `thinkingMs +
    words × wordMs` with fake timers, `fetch` is never called, and `onAction` gets the highlight.
    *Protects: I3/I5. The same answer every time, with no joke.*
  - All at the component/unit layer.

### §10 — Screens (I10)
The demo is recorded on desktop (1920×1080) and must not break on phones. Built and checked at
390px first (mobile-first invariant). The Connect window and the answer panel never show at the
same time. The overlay manager already stacks them, and closing the Connect window restores the
answer panel.

### Final acceptance (relevant)
Opening the site without `?demo=` behaves as it does today: the intro, a real AI status check,
and the joke answer when disconnected.

## Notes for this stage
- Follow the stage 4/5 pattern: demo prop overrides internal behaviour; absent prop = unchanged.
- Timing values (1500 / 90) come from the `scriptedAnswer` object, not hardcoded in the panel.
- `actions` fire once, when the answer starts (i.e. after thinkingMs, as the first word appears).
- Never call `fetch` in the scripted path; test asserts it with a spy.
- Clean up timers on unmount / when `scriptedAnswer` changes (runner can abort mid-answer).
