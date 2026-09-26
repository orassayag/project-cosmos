# Demo Mode — Additions to the Project

> Proposed additions to `demo-plan.md`. **The developer accepted all five at finalize, and they
> are built as part of `demo-plan.md` Design §8.** This table keeps the original costed menu.
>
> **Session %** is the share of one 5-hour session's 15,000,000-token allowance an AI agent
> would burn implementing that addition end to end (see `~/.claude/skills/_lib/session-cost-model.md`).

## ➕ Additions to the Project (5): 0 🟣 | 0 🔴 | 3 🟡 | 2 🔵 | 0 🟠

| # | Category | Value | Conf | Title | Detected by | Size | Session % | Description |
|---|----------|-------|------|-------|-------------|------|-----------|-------------|
| A1 | UX | 🟡 Medium value | C2 | Visible fake mouse pointer | Claude | S | 4% | Automated clicks are invisible on video — things just change. A drawn pointer that glides to each button and shows a small ripple on "click" makes it read as "a person using it". Built as one absolutely-positioned element the runner moves to the target's on-screen box. (Pushed up half a row: needs visual checking.) |
| A2 | Feature | 🟡 Medium value | C2 | End card with contact links | Claude | S | 2% | Two of the three goals are jobs and LinkedIn reach. A final card ("Built by … · GitHub · LinkedIn") when the demo ends turns the video into a call to action. One small component shown after the last step. (Pulled down half a row: copies an existing panel style.) |
| A3 | UX | 🟡 Medium value | C2 | Caption bar for silent autoplay | Claude | S | 3% | LinkedIn videos autoplay muted. A one-line caption per step ("Connecting an AI agent…") explains what's happening without sound. Each script step gets an optional `caption` string. |
| A4 | Ops | 🔵 Low value | C2 | One-command re-recording | Claude | S | 4% | A Playwright script that opens `?demo=ai` / `?demo=all` at a fixed window size and saves the video file, so re-recording after UI changes is one command. (Pushed up half a row: needs visual checking.) |
| A5 | DX | 🔵 Low value | C2 | Speed dial for rehearsals | Claude | XS | 1% | `?demo=all&speed=4` plays the script 4× faster, so checking the tour doesn't take 2 minutes each time. The runner divides every `durationMs` by the factor. |

**Total if all additions are built: ~14% of a 5h session.**
