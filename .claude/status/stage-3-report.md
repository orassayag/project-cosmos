## Files
scripts/readme-reminder.sh
scripts/__tests__/readme-reminder.test.sh
scripts/install-hooks.sh
README.md

## Summary
Added a tracked commit-msg hook body (`scripts/readme-reminder.sh`) that, on `feat`/`!`/`BREAKING CHANGE` commits without `README.md` staged, prints a warning plus an example `gh repo edit --description ... --add-topic ...` command to stderr. It never runs `gh` and always exits 0. Staged files are overridable via `README_REMINDER_STAGED_FILES`. `install-hooks.sh` now installs a `commit-msg` wrapper alongside the untouched post-commit hook. README's Versioning section and scripts line mention the reminder.
Checks: shell test passed (7 cases, exit codes 0); `bash scripts/install-hooks.sh` installed both hooks, and the installed commit-msg hook printed the warning with exit 0; `npm run build` passed.

## Commit message
feat(hooks): remind to refresh README on feature commits

Feature and breaking commits often change the public pitch, but the README
and GitHub description drift. A non-blocking commit-msg hook prints a
reminder and a ready-to-run gh command; installed via install-hooks.sh.

## Key decisions
- Advisory only: exit 0 always, gh command is printed text, never executed.
- Matches `feat`, any type with `!`, and a `BREAKING CHANGE` footer; `docs/README.md` does not count as README staged (exact-line match).
- post-commit hook and version-bump.sh untouched.
- README edited because it already documents the hooks; CLAUDE.md untouched.
