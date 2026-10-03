# Master Stage Plan
Plan: docs/plans/ai-refactor.md
Branch: feature/ai-refactor
Split: medium (cap 10 stages, ~450 LOC/stage target)
Review budget: 120 minutes
Generated: 2026-10-03T08:13:56Z

## Scope estimate
~3300 LOC estimated (incl. tests) across ~45 files → ceil(3300 / 450) = 8 stages, ~410 LOC/stage.

## Stages
- Stage 1: COMMITTED — Keyless server: agentConfig, loopback-only dev server, /ai/status + /ai/ask on env keys, cookie/connect removal (1.1, server half of 1.4)
- Stage 2: COMMITTED — Client entry point: drop top-bar/drawer inputs, AgentButton (red/green, phone-first), useAiConnection status reasons, client leftovers + interim errors (1.2, client half of 1.4, 1.5)
- Stage 3: COMMITTED — Keyless setup window by reason + billing note, A-key toggle + help, .env.example / fresh-start / README (1.3, A2, A5, docs of 1.4)
- Stage 4: COMMITTED — Chat request contract + client trimming, follow-up-aware routing, fixed off-topic reply, 13-tool allow-list (2.1, 2.2, 2.3)
- Stage 5: COMMITTED — useAgentChat hook: in-flight ownership, stop marker, new-chat abort, errors + token usage, askStream { messages } (2.4)
- Stage 6: COMMITTED — AgentChat panel: phone sheet / desktop dock, collapse-after-answer layout, Stop/New chat, thinking dots, counter, follow-up chips ⚠ large (~700 LOC) (2.5, 2.6, 2.7, A3, A4)
- Stage 7: COMMITTED — Scripted demo turns: aiTour.turns data + validator + schema/types/fixtures, scripted answering, demo scripts on new targets (2.8)
- Stage 8: COMMITTED — Playwright agent-chat spec (demo, chat, phone) + final README/acceptance pass (2.9, A1)
