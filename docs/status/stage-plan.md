# Master Stage Plan
Plan: docs/plans/demo-plan.md
Branch: feature/add-ai
Review budget: 120 minutes
Generated: 2026-09-26T00:00:00Z

## Scope estimate
~2300 LOC across ~30 files (new `client/src/demo/` module, demo props on three components,
App wiring, four demo UI pieces, a Playwright recorder) → 14 stages at ≤250 LOC / ≤6 files
each. The per-stage ceilings, not the 120-minute budget, set the count. Build order follows
the plan: §1–§6, §8, §9 before §7.

## Stages
- Stage 1: COMMITTED — §1/§2: demo/types.ts (step union, DemoTarget, DemoActions), demoMode.ts (readDemoMode, speed clamp, shouldShowIntro) + demoMode.test
- Stage 2: COMMITTED — §1/A5: runDemo.ts (sequential steps, abortable sleep, speed divisor) + runDemo.test (fake timers, order, speed, abort, trusted pointerdown)
- Stage 3: COMMITTED — §3: useAiConnection `enabled` option + test, demo/useDemoAiConnection.ts (runner-driven fake connection, no network)
- Stage 4: COMMITTED — §4: ConnectAgentModal `demo` prop (controlled dialog, JEV "site owner" field, no onConnect) + ConnectAgentModal.test cases
- Stage 5: COMMITTED — §5: AskAgent demoQuestion/demoExpanded/demoSearchPressed props + AskAgent.test cases
- Stage 6: COMMITTED — §5: AskPanel `scriptedAnswer` (fixed thinking/word pace, actions, no fetch, no joke) + AskPanel.test cases
- Stage 7: COMMITTED — §5/§6/§9: demo/scriptedAnswer.ts + test, demo/scripts.ts (`demo=ai` table) + scripts.test (ai ≤ 60s, handler + target coverage)
- Stage 8: COMMITTED — §1/§2/§3: demo/useDemoRunner.ts (AbortController, trusted-input abort, data-demo-state) + App.tsx wiring for `demo=ai` (intro skip, fake/real AI swap, DemoActions)
- Stage 9: COMMITTED — A1/A3: DemoPointer.tsx + DemoCaption.tsx + responsive.css (pointer hidden on touch, caption behind detail cards) + App mount
- Stage 10: COMMITTED — A1: `data-demo-target` attributes on Connect, provider, key fields, submit, Search, domain buttons, play/step controls, legend toggle, intro button
- Stage 11: PLANNED — A2: DemoEndCard.tsx + OVERLAY.demoEndCard + close button + DemoEndCard.test
- Stage 12: PLANNED — §7: `demo=all` script (scenario-derived segment 2 time) + new DemoActions wired in App (pressIntro, playScenario, stepBack/Forward, openIncident, toggleLegend) + scripts.test (all ≤ 120s)
- Stage 13: PLANNED — A4: scripts/record-demo.mjs, `record:demo` npm script, playwright devDependency, recordings/ gitignored
- Stage 14: PLANNED — Final acceptance: /test, record:demo ai + all under limits, 390×844 / 844×390 manual check, no-`?demo=` regression check
