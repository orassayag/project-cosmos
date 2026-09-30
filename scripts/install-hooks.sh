#!/usr/bin/env bash
# Install this repo's local git hooks. The hooks live in .git/hooks/ (not tracked by
# git), so run this once per clone to wire up auto-versioning (scripts/version-bump.sh).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hook="$REPO/.git/hooks/post-commit"

cat > "$hook" <<'EOF'
#!/usr/bin/env bash
# Local hook (not tracked in git). After every commit, record a version in the
# per-year ledger under versions/ and tag it. All logic lives in the tracked script.
exec "$(git rev-parse --show-toplevel)/scripts/version-bump.sh"
EOF
chmod +x "$hook"

commitMsgHook="$REPO/.git/hooks/commit-msg"

cat > "$commitMsgHook" <<'EOF'
#!/usr/bin/env bash
# Local hook (not tracked in git). On feat/breaking commits without README.md staged,
# prints a reminder to refresh the README and GitHub description. Never blocks a commit.
exec "$(git rev-parse --show-toplevel)/scripts/readme-reminder.sh" "$1"
EOF
chmod +x "$commitMsgHook"

echo "Installed post-commit hook → $hook"
echo "Installed commit-msg hook → $commitMsgHook"
