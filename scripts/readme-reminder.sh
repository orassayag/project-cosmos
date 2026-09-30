#!/usr/bin/env bash
# commit-msg hook body. Advisory only: prints a reminder to refresh README.md and the
# GitHub description on feature/breaking commits, and always exits 0.
# Usage: readme-reminder.sh <commit-message-file>
# Test override: README_REMINDER_STAGED_FILES (newline-separated) replaces `git diff --cached`.
set -euo pipefail

messageFile="${1:-}"
if [ -z "$messageFile" ] || [ ! -f "$messageFile" ]; then
  exit 0
fi

subject="$(head -n 1 "$messageFile")"
isFeatureOrBreaking=false
if [[ "$subject" =~ ^feat(\([^\)]*\))?!?: ]] || [[ "$subject" =~ ^[a-z]+(\([^\)]*\))?!: ]] \
  || grep -qE '^BREAKING[ -]CHANGE' "$messageFile"; then
  isFeatureOrBreaking=true
fi
if [ "$isFeatureOrBreaking" != true ]; then
  exit 0
fi

if [ -n "${README_REMINDER_STAGED_FILES+x}" ]; then
  stagedFiles="$README_REMINDER_STAGED_FILES"
else
  stagedFiles="$(git diff --cached --name-only 2>/dev/null || true)"
fi

if printf '%s\n' "$stagedFiles" | grep -qx 'README.md'; then
  exit 0
fi

cat >&2 <<'MESSAGE'

[readme-reminder] This looks like a feature/breaking commit but README.md is not staged.
Check whether README.md is now stale. If the project's public pitch changed, refresh the
GitHub description/topics too (example only, not run for you):

  gh repo edit --description "<one-line description>" --add-topic <topic>

MESSAGE
exit 0
