# Stage 8 — open questions (non-blocking; all Phase 8 work is done)

## Q1. Should the `demo=ai` tour show one of the new Ask map actions?

CLAUDE.md says every AI change is reflected in `demo=ai` in the same change. Stage 8 makes the client run the five
agent map actions (`showBlastRadius`, `openPassport`, `showHealth`, `showOwnership`, `openChangelogEntry`), but the
tour is unchanged.

Why not added: the scripted answer fires its actions the moment typing starts. Every one of these actions opens a
view **above** the answer (the answer keeps streaming underneath and comes back when the view closes), so the tour
would show the view instead of the answer being typed. The one exception is `openPassport` on desktop, which opens
the inspector on the right beside the answer — but on a phone it covers the answer.

Options:
- **A.** Leave `demo=ai` as is; Phase 9 rewrites the tour data (`data.demo.aiTour`) anyway — decide there.
- **B.** Add `openPassport` for `shipping` to the scripted answer now (desktop shows passport + answer side by side;
  phone shows the passport, answer returns when it is closed). Fits in 60 s.
- **C.** Let scripted actions fire when the answer finishes typing instead of when it starts, then add one action.

## Q2. Desktop behaviour of surface-opening actions — keep?

Chosen (smallest change that keeps the answer): on desktop an Ask action opens blast radius / health / ownership /
changelog **above** the Ask panel (`overlay.open(id, { keepBeneath: true })`), hiding the answer until the view is
closed (button, `B`/`H`/`O`, or Esc in the changelog). Without that, the desktop single-slot manager would unmount
the Ask panel and abort the stream as soon as the agent called the tool. `openPassport` shows the inspector on the
right beside the answer. If you would rather keep the answer visible and open the view next to it (or defer the
action until the answer is done), say so.

## Owner answers (2026-10-03)
- Q1: A — defer to Phase 9 (recorded in the decisions log).
- Q2: keep as built.
