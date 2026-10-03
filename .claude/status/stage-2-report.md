# Stage 2 report — Client entry point

## Files
client/src/hooks/useAiConnection.ts
client/src/hooks/__tests__/useAiConnection.test.ts
client/src/components/AskAgent.tsx
client/src/components/AgentButton.tsx
client/src/components/__tests__/AskAgent.test.tsx
client/src/components/__tests__/AgentButton.test.tsx
client/src/components/AskPanel.tsx
client/src/components/__tests__/AskPanel.test.tsx
client/src/components/askStream.ts
client/src/components/ConnectAgentModal.tsx
client/src/components/__tests__/ConnectAgentModal.test.tsx
client/src/App.tsx
client/src/__tests__/askMapActions.test.tsx
client/src/styles/app.css
client/src/styles/responsive.css
client/src/demo/useDemoAiConnection.ts
client/src/demo/__tests__/useDemoAiConnection.test.ts
client/src/demo/types.ts
client/src/demo/scripts.ts
client/src/demo/__tests__/scripts.test.ts
client/src/demo/__tests__/demoTargets.test.tsx
client/src/demo/__tests__/runDemo.test.ts

(`AskAgent.tsx` and `AskAgent.test.tsx` are deleted. `AgentButton.tsx` and `AgentButton.test.tsx` are new and replace them. Git sees these as delete + add, not a rename.)

## Summary
- **Top-bar input removed.** The `AskAgent` field is gone from the desktop header and the phone `.lc-topbar-search` row. A new `AgentButton` replaces it: a round 48px chat-bubble bot with a speech-tail and a status-dot badge, `aria-label="Open the agent chat"`. It is green (`lc-agent-button--on`) when the agent is connected, red (`--off`) for `notLocal`/`notConfigured`, and grey (`--unknown`) while the status check runs. Green opens the answer panel. Red or grey opens the setup window (`OVERLAY.connect`).
- **Position.** The bot sits bottom-right on every size, set in `responsive.css` as `bottom: calc(var(--playback-h) + 12px + var(--safe-bottom))`.
  - `--playback-h` didn't exist, so I defined it per layout:
    - idle desktop: `106px` (above the zoom stepper)
    - compact desktop while playing: transport clearance + the zoom stepper
    - phone idle: `112px` (lined up with the zoom column)
    - phone while playing: `--lc-controls-h + 10px`
  - Desktop: the bot moves to `right: 388px` when the step panel is open, the same as the zoom stepper.
  - Phones: the bot hides while any bottom sheet, narration strip, unhidden ask panel or the setup window is showing (the same policy as the steppers). It also hides in presentation mode.
- **`useAiConnection`.** It now only checks status and has no `connect`/`disconnect`. Status is `unknown | connected | notLocal | notConfigured`. A 503 `AI_NOT_CONFIGURED` gives `notConfigured`. A 200 that reports connected gives `connected`. Anything else, including 503 `AI_NOT_LOCAL`, other errors and network failures, gives `notLocal`. When disabled it reports `notLocal`.
- **Key-rejected → disconnect path removed (I7).** `DISCONNECTING_ERROR_CODES` and `onKeyRejected` are deleted, so a provider error stays visible and the bot stays green (§1.5).
  - `INVALID_KEY` now reads "Your AI provider refused the key — check the key in server/.env, then restart pnpm dev."
  - `NOT_CONNECTED` is replaced by messages for `AI_NOT_LOCAL` and `AI_NOT_CONFIGURED`.
- **`AskPanel`.**
  - Removed: the joke answers (`DEMO_ANSWERS`) and the canned word-by-word path, plus the `showConnectPrompt`, `onConnectRequest`, `isAiConnected` and `onKeyRejected` props.
  - New: a minimal question box (textarea `ask-input` + `Search` button `ask-search`, Enter submits) and a required `onAsk` prop.
  - With `question === ''` (opened from the bot) only the question box shows and nothing is fetched. Otherwise it streams the live answer, or plays the scripted one in a demo.
- **`App.tsx`.**
  - Removed: the random-star fallback, `handleDisconnect`, and the AskAgent wiring.
  - New: `handleOpenAgentChat`. It brings back a still-mounted answer panel, or opens an empty one. Remounting a panel would call the agent again, which is why it never does that.
  - `handleAsk` always opens with `[]` focus ids (scripted answer only during a demo).
- **`ConnectAgentModal`.** The key inputs, provider picker, visitor JEV key field and Connect submit are gone. It is now a static "The agent runs locally" window with its close button, Escape and overlay stacking. It takes no props; the wording by reason is stage 3.
- **Demo.** `useDemoAiConnection()` takes no arguments and always reports connected (no fake connect; `DEMO_CONNECT_MS` is removed). Both tours now: click the bot (target `connect-open`), click the panel's `ask-input`, type, click `ask-search`, wait for the scripted answer. The fake-key paste steps and their targets are removed.
- **CSS.** I removed the dead top-bar `.lc-ask*` / starter / `.lc-ask-connect` rules and added `.lc-agent-button*` and `.lc-ask-composer*` (16px font on phones so iOS doesn't zoom on focus).
- **Checks.**
  - `pnpm typecheck`: green.
  - `pnpm lint`: 0 errors. The 1 warning (`Map.tsx:834` exhaustive-deps) was already there; I didn't touch `Map.tsx`.
  - `pnpm test`: green — server 339/339, client 185/185 (26 files, including every touched test), plus scripts tests.
  - `pnpm build`: green.
  - `grep AI_COOKIE_SECRET client/`: no matches.
- **Manual checks (Playwright, headless Chromium, against my own `pnpm dev:server` + Vite on :5199, both stopped afterwards):**
  - Red bot, 390×844, 844×390 and 1440×900: the bot doesn't overlap the zoom stepper, and a click opens the setup window with its close button.
  - Desktop while playing: the bot is clear of the transport, zoom and step panel.
  - Phone while playing: the bot is hidden while the step panel shows. With the step panel closed it sits above the transport (bottom 690 vs transport top 702).
  - Green bot (dev server started with a fake `ANTHROPIC_API_KEY`), at all three sizes: a click opens the panel and the bot hides behind it on phones. Asking shows the "refused the key" error and the bot stays green.
  - `?demo=ai` ran to `data-demo-state=done` on desktop (about 20s) and phone (about 22s), with the scripted answer shown.
  - I did not re-record the demos with `pnpm record:demo`.

## Commit message
feat(client): replace top-bar ask field with bottom-right agent bot

The server now reads AI keys from local env, so the client no longer
connects or disconnects: a status-only hook drives a red/green bot,
and provider errors stay visible instead of logging the visitor out.

## Key decisions
- `AiConnection = { status: AiConnectionStatus; provider: AiProvider | null }`, where `AiConnectionStatus = 'unknown' | 'connected' | 'notLocal' | 'notConfigured'` (`client/src/hooks/useAiConnection.ts`). `ConnectResult`, `ConnectErrorCode`, `connect` and `disconnect` no longer exist.
- `AgentButton({ status, provider, onOpenChat, onOpenSetup })` in `client/src/components/AgentButton.tsx`.
  - Classes: `lc-agent-button lc-agent-button--on|off|unknown`. The dot is `lc-status-dot--on|off|unknown` with `data-testid="ai-status-dot"`.
  - Status text is in `title`. The button carries `data-demo-target="connect-open"`.
- `AskPanel` props are now `{ question, onAsk, hidden?, onClose, onAnswerStart?, onAction?, scriptedAnswer? }`. `question === ''` means the panel was opened empty from the bot. Its question box is a textarea labelled "Your question" (`data-demo-target="ask-input"`) plus a `Search` button (`ask-search`).
- `ConnectAgentModal()` takes no props. Stage 3 will likely add a `reason`/`status` prop for wording by `notLocal` vs `notConfigured`.
- `useDemoAiConnection()` takes no arguments and returns a constant `{ status: 'connected', provider: 'anthropic' }`.
- `DEMO_TARGETS` dropped `connect-provider-anthropic|openai`, `connect-provider-key`, `connect-jev-key` and `connect-submit`. It keeps `connect-open` (now on the bot), `ask-input` and `ask-search`.
- The `--playback-h` CSS custom property is defined on `.lc-stage` in `responsive.css`. The bot's phone hide list is next to the stepper hide rule there; any new bottom sheet should be added to both.
- `ASK_ERROR_MESSAGES` (`client/src/components/askStream.ts`) has no `NOT_CONNECTED` and adds `AI_NOT_LOCAL`.

## Open questions
- **File ceiling exceeded (22 paths vs 10).** The stage needs the hook, the component rename, the panel, the modal, App, CSS and their tests. Removing `connect`/`disconnect` and the Connect form also forced edits to the demo layer (types, scripts and four demo/App tests) to keep `pnpm test` green. Every demo/test edit is the smallest one that compiles and passes. `App.tsx` (945 lines), `app.css` and `responsive.css` were already over the 400-line ceiling before this stage.
- **The demo target name `connect-open` is kept on purpose.** It now marks the bot, so `runDemo.test.ts`, `useDemoRunner.test.ts` and `DemoPointer.test.tsx` didn't need changes. Plan §2.8 renames it to `agent-button`, and stage 7 should do that rename. The tour change here is interim: no connect steps, the bot is already green, and the steps are click bot → type → Search. Demos were not re-recorded.
- The bot's grey `unknown` state opens the setup window. Stage 3 may prefer to ignore clicks until the status settles.
- On a desktop with the panel still open, clicking the green bot only brings the panel to the front. Once the panel has been closed (removed from the overlay stack), the next click opens an empty panel. The old answer is not restored, because restoring it would call the agent again.
- On 844×390 landscape, the question box sits below the fold of the 50%-height bottom sheet until you scroll it. The sheet scrolls, but the chat in stage 5/6 should pin its composer.
- The connect-form CSS (`.lc-connect-form`, `-provider`, `-input`, `-submit`, …) in `app.css` is now dead. I left it for stage 3, which rewrites the setup window. The `README.md` "Connecting" / Ask section also still describes the old top-bar field and cookie flow; that is a stage 3 item.
