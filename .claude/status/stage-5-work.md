# Stage 5 work brief — §5: AskAgent demo props

Plan: docs/plans/demo-plan.md
Stage line: "§5: AskAgent demoQuestion/demoExpanded/demoSearchPressed props + AskAgent.test cases"

## Scope for this stage (AskAgent only)
- `AskAgent` component + its test file (`AskAgent.test.tsx`). Nothing else unless a type
  must be shared (then `client/src/demo/types.ts`).
- **Out of scope:** `AskPanel` `scriptedAnswer` (stage 6), `demo/scriptedAnswer.ts` (stage 7),
  the runner-driven typing growth and App wiring (stage 8), `data-demo-target` attributes
  (stage 10). AskAgent only *renders* whatever `demoQuestion` it is given; the one-char-per-55ms
  growth is produced upstream by the runner/App.

## Plan text (pasted verbatim, §5)

### §5 — Question and scripted answer (I3, I4)

- `AskAgent` gets optional `demoQuestion?: string`, `demoExpanded?: boolean`, and
  `demoSearchPressed?: boolean`. When `demoQuestion` is defined, it is the text shown and the
  focus-clears-text path is bypassed. The `type` step grows the text one character per 55ms, so
  it looks like a person typing. The `ask` step shows the Search button pressed for 250ms, then
  the runner calls `onAsk(question)` directly.
- Demo question: *"Which services does placing an order go through, and who owns them?"*
  (69 characters, about 3.8s to type).
- `AskPanel` gets an optional `scriptedAnswer?: { text: string; thinkingMs: number; wordMs:
  number; actions?: AskAction[] }`. When it is set, the panel plays that text with fixed timing
  (thinking 1500ms, 90ms per word) and fires `actions` when the answer starts. The joke list and
  the connect prompt are skipped, and no request is made. The joke list is untouched for normal
  visitors.
- The answer is about 70 words of fictional AstroMart facts, taken from the
  `shopping.place-order` steps and `owners.ts`. It lives in `client/src/demo/scriptedAnswer.ts`,
  with a `highlight` action for the services it names.
- Tests:
  - `AskAgent.test.tsx`: `demoQuestion` renders, focusing the box does not clear it, and the
    Search pressed state shows. *Protects: I4.*
  - `AskPanel.test.tsx`: `scriptedAnswer` renders the exact text after `thinkingMs +
    words × wordMs` with fake timers, `fetch` is never called, and `onAction` gets the highlight.
    *Protects: I3/I5. The same answer every time, with no joke.*
  - `client/src/demo/__tests__/scriptedAnswer.test.ts`: every highlighted id exists in
    `SERVICES`. *Protects: the answer stays true to the map when services change.*
  - All at the component/unit layer.

## This stage's deliverables
1. `demoQuestion?: string` — when defined, the input shows exactly this text (controlled,
   read-only so stray input can't change it), and focusing the box does NOT clear it.
2. `demoExpanded?: boolean` — when defined, forces the expanded/collapsed state of the Ask box
   (whatever "expanded" means in the current component) instead of internal state.
3. `demoSearchPressed?: boolean` — when true, the Search button renders in its pressed state
   (reuse an existing pressed/active class or add a minimal one; keep it visible on mobile).
4. When none of the demo props are passed, behaviour is exactly unchanged.
5. Tests in `AskAgent.test.tsx`: demoQuestion renders; focus doesn't clear it; pressed state
   shows when `demoSearchPressed`; non-demo path unchanged (existing tests still pass).
