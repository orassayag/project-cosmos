# Stage 6 report — AgentChat panel

## Files
client/src/components/AgentChat.tsx
client/src/components/AskPanel.tsx
client/src/components/followUps.ts
client/src/components/askStream.ts
client/src/components/Spotlight.tsx
client/src/hooks/useAgentChat.ts
client/src/App.tsx
client/src/map/Map.tsx
client/src/demo/types.ts
client/src/styles/app.css
client/src/styles/responsive.css
client/src/components/__tests__/AgentChat.test.tsx
client/src/components/__tests__/AskPanel.test.tsx
client/src/components/__tests__/followUps.test.ts
client/src/__tests__/chatLayout.test.tsx
client/src/__tests__/askMapActions.test.tsx
client/src/__tests__/agentShortcut.test.tsx
client/src/demo/__tests__/demoTargets.test.tsx
client/src/hooks/__tests__/useAgentChat.test.ts
README.md

## Summary
- `AskPanel` is gone. The new `AgentChat` shows the chat from `useAgentChat`: user and agent bubbles, the streaming reply, error bubbles with a "Try again" button, token count under finished replies, and a "Reply stopped" note.
- Phone: a full-width bottom sheet (max 75vh) with its own top-right close button. It joins the "one card at a time" block in place of the old ask card. The message list scrolls and the composer stays pinned, so the question box no longer drops below the fold on 844×390.
- Desktop: docked on the right, 360px wide, below the top bar. The zoom steppers and the bot move left of it.
- Layout rules (I5): if a right-side card (step panel, health card, changelog) opens while a reply is streaming, the chat stays open and the card waits. Once the reply ends, the chat folds into a small tab with the latest line and an unread dot. Clicking the tab, the bot, or pressing `A` reopens the chat and closes that card. A playing scenario keeps playing. The inspector stays on the left while the chat is docked, and `focusNode` pads `right: 380`.
- Thinking dots show until the first chunk (`aria-label="The agent is thinking"`). They are static when reduced motion is on.
- Counter: shows `N / 500` past 400 characters. At 500 it turns red and Send is disabled. The textarea has `maxLength=500`.
- Stop replaces Send while a reply streams. New chat sits in the header and returns to the starter chips.
- Follow-up chips: pure `suggestFollowUps(lastAnswer, snapshot)` in `followUps.ts`. It gives at most 3 chips from the answer's map actions and the service/scenario ids it mentions, and only uses ids that exist. Tapping a chip sends it.
- `A` now toggles the new chat. The demos still work: the composer keeps `ask-input` / `ask-search`, and the scripted answer plays through the chat.
- README: updated the Ask the agent section, the feature bullet and the `A` row.
- Checks: `pnpm typecheck` passes. `pnpm lint` has 0 errors and 1 old warning (`client/src/map/Map.tsx:836`, was :834). `pnpm test` passes: client 288, server 360, scripts 11, including the demo script length tests. `pnpm build` passes.
- I ran `?demo=ai` in Playwright on my own Vite (port 5199) at 390×844, 1440×900 and 844×390 and looked at screenshots. The phone sheet, the desktop dock with the inspector on the left, and the pinned composer in landscape all look right. I did not check the folded tab in a browser: that needs a live agent. It is only covered by `chatLayout.test.tsx`. Not checked with a real key.
- Demos not re-recorded (`pnpm record:demo` not run).

## Commit message
feat(client): replace the answer panel with a multi-turn agent chat

The agent is now a conversation, so it needs a chat window rather than a one-question panel.
It is a bottom sheet on phones and a right-side dock on desktop. It folds away only after an
answer ends, has Stop and New chat, and suggests follow-ups without extra model calls.

## Key decisions
- **20 files, over the 10-file ceiling.** The brief flagged this stage as large. The extra files are the AskPanel deletions, tests that pointed at `.lc-ask-panel`, and a one-line `keepAsk` removal in `Spotlight.tsx`. `App.tsx` (973 lines) and `Map.tsx` were already far past the 400-line ceiling before this stage.
- **On desktop the chat is not in the overlay manager.** On phones it is still `OVERLAY.ask` in the stack, so one card at a time still applies. On desktop it uses its own dock state in the shell (`isChatDockOpen`), so map legends and modals never close it. Esc reset still closes it, through `resetNonce`.
- **The chat view is derived, not stored.** It is `collapsed` when a right card is open and no reply is streaming. If the visitor closes that card themselves, the chat opens again by itself.
- **While streaming, the right card is held back, not just hidden.** `StepPanel` gets `open={panelOpen && !isChatDocked}`, the changelog gets `open` false, and Map holds back the health card. Their state is kept. A changelog the visitor clicks mid-reply therefore only shows once the reply ends. This is the plan rule applied the same way to every card.
- **Map has new props** `chatDocked`, `healthCardCloseNonce`, `onHealthCardChange`. App needs to know when the health card is open and needs a way to close it without leaving health mode. `keepAsk` is removed everywhere: the chat no longer shares the left edge, so node clicks no longer close it.
- **The map focus no longer reads the overlay.** App passes `askFocusIds` only while the chat is open and shown, and an empty list while it is folded. This way, highlights from a finished answer don't dim a scenario that is playing.
- **The folded tab sits above the bot** on the bot's right edge and moves with it beside the step panel. A strip on the very edge would have overlapped the 14px-inset step panel.
- **`AskAction` moved to `askStream.ts`**, where the stream protocol lives. Its importers were updated.
- **`useAgentChat` changes:** replies now carry `actions: AskAction[]`, which the follow-up chips need. New `sendScripted(question, answer)` plays the demo answer word by word through the same message flow, so Stop and New chat also work in demos. It is meant to be replaced by stage 7's scripted turns. Shared `startRequest` keeps stage 5's order: stop first, then build history.
- **The starter chips are back.** I brought back the deleted `STARTER_QUESTIONS` and their dashed-pill style, because the plan's "existing starter-chip style" no longer existed.
- **The Send button is an icon** with `aria-label="Send"`. The demo-target test now checks the label instead of the text "Search". Send is also disabled while the draft is empty.
- The folded tab and the right-card rules are desktop only. On phones the stack and the one-card CSS already keep the chat and other cards apart.
- Left for later: stale "answer panel" wording in a `ConnectAgentModal.tsx` comment and its test name (not touched, out of scope). The old `.lc-chat-trigger` CSS is unused and was left alone.
