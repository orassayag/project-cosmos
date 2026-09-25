# Real AI Agent for "Explore Project Cosmos" — Additions to the Project

> Proposed additions that are **not** part of `add-ai.md`. Nothing here is
> scheduled or committed to — this is the costed menu.
>
> **Session %** is the share of one 5-hour session's 15,000,000-token allowance an AI agent
> would burn implementing that addition end to end (see `~/.claude/skills/_lib/session-cost-model.md`).

## ➕ Additions to the Project (1): 0 🟣 | 0 🔴 | 0 🟡 | 1 🔵 | 0 🟠

| # | Category | Value | Conf | Title | Detected by | Size | Session % | Description |
|---|----------|-------|------|-------|-------------|------|-----------|-------------|
| A1 | Feature | 🔵 Low value | C3 | Let the agent replay past incidents too | Claude | XS | 1% | The agent already knows the incidents (§6 digest), and JEV already detects an `incident` intent. But the agent can only play scenarios, not incidents. Example: "show me the Black Friday outage" gets a text answer, but the incident doesn't play on the map. Built as a third tool, `play_incident({ incidentId })`, checked against the snapshot's incident ids. On the client it goes through the same `?incident=` selection path the deep link uses (`useDeepLink.ts`). |

**Total if all additions are built: ~1% of a 5h session.**
