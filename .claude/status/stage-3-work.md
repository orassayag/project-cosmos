# Stage 3 — README/GitHub-description reminder hook + shell test + install-hooks wiring

Plan: docs/plans/unfork-project.md (§3). Ledger so far: docs/status/ledger.md (stages 1–2 committed).

## Plan §3 (verbatim)
### 3. Reminder hook (I2)
- Add a tracked `commit-msg` (or `pre-commit`) hook script under `scripts/`. On `feat:` or breaking (`!`/`BREAKING CHANGE`) commits where `README.md` is not staged, print a warning plus the ready-to-run `gh repo edit --description "..." --add-topic ...` command. It never runs `gh` and never blocks the commit (exit 0).
- Wire it in `scripts/install-hooks.sh` so a fresh clone gets it; leave the post-commit ledger hook untouched.
- Verify: a shell test/fixture (e.g. `scripts/__tests__/readme-reminder.test.sh`) feeding sample commit messages and staged-file lists — asserts the warning appears for `feat:` without README, is silent for `fix:` or `feat:` with README staged, and the exit code is always 0. Narrowest layer: script-level unit. Also confirm `bash scripts/install-hooks.sh` installs both hooks.

## Notes
- Existing: scripts/install-hooks.sh writes only .git/hooks/post-commit (wrapper exec'ing scripts/version-bump.sh). Keep that behaviour; add a commit-msg wrapper that exec's the tracked script (same pattern), passing "$1".
- Expected files: scripts/readme-reminder.sh (new), scripts/__tests__/readme-reminder.test.sh (new), scripts/install-hooks.sh (edit). Update the install-hooks final echo to mention both hooks. Add a line about the hook to README.md only if README documents scripts/hooks (check; do not edit CLAUDE.md).
- Make the script testable: staged-file list overridable via env var README_REMINDER_STAGED_FILES, else `git diff --cached --name-only`.
- Keep the gh command a printed example only (placeholder description/topic); never execute gh.
- Do NOT touch the post-commit hook or version-bump.sh. Comments only where they state a non-obvious why.
