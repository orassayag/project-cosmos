# Stage 10 report — M1: AskPanel connect prompt + starter question chips

## Files
client/src/components/AskAgent.tsx
client/src/components/AskPanel.tsx
client/src/components/__tests__/AskAgent.test.tsx
client/src/components/__tests__/AskPanel.test.tsx
client/src/App.tsx
client/src/styles/app.css
client/src/styles/responsive.css

## Summary
This stage adds two things.

**Connect prompt under the joke answer.** When no AI agent is connected, the joke answer in the answer panel now ends with an underlined line: "Connect an AI agent for real answers." It is a button, and clicking it opens the Connect modal through `overlay.open(OVERLAY.connect)`.
- The line only appears once the joke has finished typing.
- It is hidden when an agent is connected, and also while the status is still `unknown`.

**Starter chips.** When the search card is expanded and the field is empty, it shows three example questions:
- "What happens when a payment fails?"
- "Which team owns checkout?"
- "Play the order flow"

Clicking a chip fills the field and submits it through `onAsk`. The chips use `onMouseDown` + `preventDefault`, like the footer buttons, so the card doesn't collapse before the click registers. They disappear as soon as the visitor types. The card grows to fit them:
- desktop: 150 → 180px
- phone portrait: 230px
- landscape phones: 190px

On touch devices the chips and the connect line are 40px tall.

No new panel was added. On phones the Connect modal stacks over the answer panel, and closing it brings the answer back. On desktop, opening the modal closes the answer panel, because desktop keeps one overlay at a time.

**Gates**

| Check | Result |
|---|---|
| `npm run typecheck` | green |
| `npm run build` | green |
| `npm run validate` | 0 errors, no drift |
| `npm test` | client 12/12 (4 new), server 2/2 |
| `npm run lint` | 0 errors; only the 2 existing exhaustive-deps warnings (AskPanel.tsx, Map.tsx) |

The new AskPanel tests are not vacuous: I forced the prompt to always render and both tests failed, then I restored the code.

**Visual / runtime check.** I drove the app with Playwright on a separate Vite server (:5292), with `/api/ai/status` mocked as disconnected. I checked phone sizes first (390×844, 844×390), then desktop 1440×900.
- **Chip layout:** 390px wraps to 3 rows, 844px fits 1 row, desktop wraps to 3 rows. Chips are 40px tall on touch and 22px on desktop.
- **No horizontal scroll:** `scrollWidth` equalled the viewport width at every size.
- **Show/hide:** chips hide after one keystroke and come back when the field is cleared.
- **Chip submit:** tapping "Which team owns checkout?" fills the field, collapses the card, and opens the answer panel with that question.
- **Connect prompt:** after the joke finishes, the prompt sits inside the answer panel and opens the modal.
- **One card at a time:** while the modal was open, the modal was the only visible card at every size.
- **Phones:** closing the modal restores the answer panel.
- **Errors:** no page errors.

## Commit message
feat(client): add AI connect prompt under demo answers and starter chips

Visitors without an AI agent get a direct path from the joke answer to the
Connect modal, and an empty search card now suggests example questions so
first-time visitors know what to ask.

## Key decisions
- AskPanel stays presentational. It takes `showConnectPrompt` and `onConnectRequest` props. App passes `aiConnection.status === 'disconnected'` from the single `useAiConnection()` instance, plus the existing `handleConnectRequest`, which calls `overlay.open(OVERLAY.connect)`.
- The prompt renders only when `phase === 'done'`, so it reads as a line under the finished joke, not something that appears mid-typing.
- `STARTER_QUESTIONS` is exported from `AskAgent.tsx` so the tests reuse the same list. A chip submit calls `onAsk(starter)` directly instead of going through `submit()`, which reads stale `question` state.
- The chips sit in the normal layout between the textarea and the footer, and the card height grows only while they are showing (`.lc-ask--starters`). The phone heights live in `responsive.css`, plus a short `max-height: 480px` block for landscape.
- File count is **7** against the ceiling of 6. The work needed a new `AskPanel.test.tsx` (the brief asked for coverage in `__tests__/`), and the phone-only rules belong in `responsive.css` by project convention. Hand-written lines stayed at about 200, under the 250 target.
