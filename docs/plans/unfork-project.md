# Unfork Cosmos — Plan

## Summary
Detach `project-cosmos` from its upstream fork (`ludeo-labs/cosmos-os`, MIT, Copyright (c) 2026 Ludeo) and present it as the maintainer's own project, honestly credited as an extension of the original. The MIT licence has no minimum-change threshold and does not require fork status; it requires the original copyright notice and licence text to stay. The work is: licence and metadata attribution, removal of now-false "fork" wording, a reminder hook for README/GitHub-description upkeep, a documentation-vs-code audit, and finally the GitHub-side detach.

## Scope
**In scope**
- `LICENSE` second copyright line; `package.json` `author`.
- Plugin manifests (`.claude-plugin/plugin.json`, `marketplace.json`) author/owner.
- README "Origin & credits" section; reword fork-specific text in `README.md` and `SECURITY.md`.
- Tracked warn-only commit hook for README/GitHub-description upkeep.
- Docs-vs-code audit checklist.
- GitHub detach and description/topics update.

**Out of scope**
- Removing or altering the Ludeo copyright line or MIT text.
- Renaming the project (repo is already `project-cosmos`); lawyer consultation.
- Any change to `drift-sync` gating (`DRIFT_SYNC_ENABLED`, not fork status).
- Auto-editing GitHub metadata from a script.

### Scope Yardstick
| Dimension | Value | Evidence |
|---|---|---|
| Kind | Personal open-source / portfolio project (shared on GitHub and LinkedIn) | Plan item 3 + GPT review; README, `package.json` homepage on Vercel |
| Audience & traffic | Public readers and recruiters; no measured traffic | ASSUMED |
| Surfaces | Public GitHub repo, Vercel static site, `.claude-plugin` manifests, nightly `drift-sync` workflow (opt-in via `DRIFT_SYNC_ENABLED`) | Repo tree, `.github/workflows/cosmos-sync.yml:72` |
| Lifetime | Maintained by one person | `git log`: 124 of 149 commits are Or Assayag's |
| Team | Solo | `CLAUDE.md` |
| Constraints | MIT-licensed upstream (Copyright (c) 2026 Ludeo); no deadline | `LICENSE:3` |

## Issue Resolutions
| ID | Title | Detected by | Resolution | Notes |
|----|-------|------------|------------|-------|
| I1 | LICENSE names only the original owner | Claude, Grok, Claude (agent), Gemini | Fixed | R1 — second copyright line + `package.json` author |
| I2 | Hook cannot judge "major feature" | Claude | Fixed | R2 — warn-only, tracked hook; never edits GitHub |
| I3 | No detach method chosen | Claude, Grok, GPT, Claude (agent), Gemini | Fixed | R3 — GitHub-side detach first, `isFork:false` check |
| I4 | Fork wording becomes false | Claude | Fixed | R4 — "Origin & credits", reword three spots |
| I5 | Plugin files name upstream author | Claude | Fixed | R5 — owner/author set to Or Assayag |
| I6 | Audit has no finish line | Claude (adversarial) | Fixed | R6 — checklist + green gates |

## Design

Execution order matters: steps 1–5 merge first so the public repo is never half-stated; step 6 (outward-facing) is last.

### 1. Licence and authorship (I1, I5)
- `LICENSE`: keep `Copyright (c) 2026 Ludeo` and the full MIT text unchanged; add `Copyright (c) 2026 Or Assayag` on the line beneath it.
- `package.json`: add `"author": "Or Assayag"`.
- `.claude-plugin/plugin.json:6` and `.claude-plugin/marketplace.json:4,11`: set `owner`/`author` to Or Assayag. Omer Sher's credit lives in README and `LICENSE`.
- Preserve any per-file copyright headers (grep for `Copyright` under `client/`, `server/`, `drift-sync/`; expected none to change).
- Verify: no test layer applies (static metadata). Check `grep -n Copyright LICENSE` shows both lines; `claude plugin validate .` if available; `npm run build` green.

### 2. Fork wording and credits (I4)
- Replace `README.md:8-12` ("About this fork") and `README.md:402` ("This repository is a fork of") with a single "Origin & credits" section: originally based on [ludeo-labs/cosmos-os](https://github.com/ludeo-labs/cosmos-os), MIT, original notice preserved in `LICENSE`, plus what was added (incidents, blast radius, health, ownership, drift, AI agent, demo tours). Keep the Medium post link.
- `README.md:348` and `SECURITY.md:13`: "off by default on forks" → "off by default".
- Verify: `grep -rniE "fork" README.md SECURITY.md` returns only intentional credit wording; no test layer (docs).

### 3. Reminder hook (I2)
- Add a tracked `commit-msg` (or `pre-commit`) hook script under `scripts/`. On `feat:` or breaking (`!`/`BREAKING CHANGE`) commits where `README.md` is not staged, print a warning plus the ready-to-run `gh repo edit --description "..." --add-topic ...` command. It never runs `gh` and never blocks the commit (exit 0).
- Wire it in `scripts/install-hooks.sh` so a fresh clone gets it; leave the post-commit ledger hook untouched.
- Verify: a shell test/fixture (e.g. `scripts/__tests__/readme-reminder.test.sh`) feeding sample commit messages and staged-file lists — asserts the warning appears for `feat:` without README, is silent for `fix:` or `feat:` with README staged, and the exit code is always 0. Narrowest layer: script-level unit. Also confirm `bash scripts/install-hooks.sh` installs both hooks.

### 4. Docs-vs-code audit (I6)
Checklist, each line ticked pass/fail (record results in the commit body or PR description):
- README commands vs `package.json` scripts.
- Env vars documented vs used in code (`grep -rn "process.env\|import.meta.env"`).
- Routes and keyboard shortcuts vs the UI.
- Folder tree in README/CLAUDE.md vs disk.
- Deploy steps vs `vercel.json` and `.github/workflows/`.

Fix every mismatch found. Done when all lines are ticked and `npm run build`, `typecheck`, `lint`, `validate` are green (and `npm test` if demo docs changed).

### 5. Version note and commit
Per project invariant: write the version note via `scripts/version-note.sh write` (plain-language bullets), check README currency, commit with Conventional Commits (e.g. `docs(license): credit maintainer alongside Ludeo`), explicit paths only.

### 6. GitHub detach (I3) — deliberate, manual, after 1–5 are merged
- Check GitHub's current documentation for the detach procedure before acting (the agents disagree: Support request vs "Leave fork network").
- Prefer the GitHub-side detach: it keeps stars, history, issues, the Vercel link and the URL that `package.json`, the Vercel homepage and `pages-redirect/` point to. Only if GitHub refuses, create a new repo and mirror-push to it, accepting the URL change (then update those three references).
- Update the description to drop "Extended fork of" using `gh repo edit --description ... --add-topic ...`.
- Done when `gh repo view --json isFork,parent` shows `isFork: false`. Support requests are not instant; until then the check keeps reporting `true`.
- Accepted gap: none from ignored issues (all six Fixed). The detach itself is asynchronous if it goes through Support.

## Open Questions
- Which detach route will GitHub's current docs offer (self-service vs Support)? Resolve at step 6.
- Confirm the author display string `Or Assayag` (matches git user) before editing manifests.
