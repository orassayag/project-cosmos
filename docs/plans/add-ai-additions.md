# Real AI Agent for "Explore Project Cosmos" — Additions to the Project

> Proposed additions that are **not** part of `add-ai.md`. Nothing here is
> scheduled or committed to — this is the costed menu.
>
> **Session %** is the share of one 5-hour session's 15,000,000-token allowance an AI agent
> would burn implementing that addition end to end (see `~/.claude/skills/_lib/session-cost-model.md`).
>
> **Update at finalize:** the developer accepted A1–A4, and they are now built into `add-ai.md` (§4, §6, §7).

## ➕ Additions to the Project (4): 1 🔴 | 1 🟡 | 1 🔵 | 1 🟠

| # | Category | Value | Conf | Title | Detected by | Size | Session % | Description |
|---|----------|-------|------|-------|-------------|------|-----------|-------------|
| A1 | Feature | 🔴 High value | C2 | Answers that act on the map | Claude | M | 8% | The agent doesn't just reply in text — it lights up the stars it's talking about or plays the matching scenario. Example: "how does an order get paid?" → the payment services glow and the checkout scenario starts. Built as LangGraph tools (functions the AI can choose to call) that return service/scenario ids, which the frontend feeds into the existing highlight and deep-link code (`useDeepLink.ts`). |
| A2 | UX | 🟡 Medium value | C3 | Stream real answers word by word | Claude | S | 3% | The answer panel already fakes typing word by word; real answers could arrive the same way, as the AI writes them, instead of all at once after a wait. Built by streaming the server response (plain `ReadableStream`) into the existing `AskPanel` typing state. |
| A3 | UX | 🔵 Low value | C3 | Starter question chips | Claude | XS | 1% | Two or three clickable example questions under the empty search box ("What happens when payment fails?"), so visitors know what to ask. Built as a small list in `AskAgent.tsx`. |
| A4 | UX | 🟠 Nice to have | C2 | Show what each answer cost | Claude | XS | 1% | A tiny "≈ 1,240 tokens" note under each answer, since visitors pay with their own key. Built from the usage numbers both providers already return. |

**Total if all additions are built: ~13% of a 5h session.**
