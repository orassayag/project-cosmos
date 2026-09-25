#!/usr/bin/env bash
# Auto-versioning for the project-cosmos repo. Invoked from .git/hooks/post-commit
# after every commit: derives a semver bump from the commit type (Conventional
# Commits), prepends a plain-English row to the per-year ledger versions/<year>.md
# (creating that file with a header on the first commit of a new year) in a follow-up
# "chore(version)" ledger commit, and tags it vX.Y.Z (local). The tagged ledger commit
# is the anchor /revert restores to.
#
# The plain-English "Change" cell is sourced from .git/version-note.md if the agent
# wrote one before committing (one bullet per line), else falls back to a de-jargoned
# commit subject — so a readable row always exists.
#
# Loop-safe: guarded by a lock file and by skipping its own ledger commits. A non-zero
# exit never fails the triggering commit (git ignores post-commit exit status).
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 0

VERSIONS_DIR="versions"
NOTE_FILE=".git/version-note.md"
LOCK=".git/version-bump.lock"

# --- guards -------------------------------------------------------------------
[ -f "$LOCK" ] && exit 0
[ -d "$VERSIONS_DIR" ] || exit 0
{ [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ] || [ -f ".git/MERGE_HEAD" ]; } && exit 0

SUBJECT="$(git log -1 --format=%s)"
BODY="$(git log -1 --format=%b)"
case "$SUBJECT" in "chore(version):"*) exit 0 ;; esac  # never version our own ledger commits

# --- classify the bump from the commit type -----------------------------------
bump="patch"
if printf '%s\n%s\n' "$SUBJECT" "$BODY" | grep -q 'BREAKING CHANGE' \
   || printf '%s' "$SUBJECT" | grep -qE '^[a-z]+(\([^)]*\))?!:'; then
  bump="major"
elif printf '%s' "$SUBJECT" | grep -qE '^feat(\([^)]*\))?:'; then
  bump="minor"
fi

# --- compute the next version from the latest vX.Y.Z tag ----------------------
latest="$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' | sed 's/^v//' \
          | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)"
latest="${latest:-0.0.0}"
IFS=. read -r major minor patch <<< "$latest"
case "$bump" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
esac
next="$major.$minor.$patch"

code_sha="$(git log -1 --format=%h)"
commit_time="$(git log -1 --format=%cd --date=format:'%d/%m/%Y %H:%M:%S')"
year="$(git log -1 --format=%cd --date=format:'%Y')"

# --- resolve the per-year ledger; create it with a header on first use --------
year_file="$VERSIONS_DIR/$year.md"
mkdir -p "$VERSIONS_DIR"
if [ ! -f "$year_file" ]; then
  cat > "$year_file" <<EOF
# $year

Version history for $year — newest first. Each row is an exact, revertable point:
run **\`/revert <version>\`** (e.g. \`/revert 1.0.0\`). Recorded automatically on every
commit; never edit by hand.

| Version | Time | Commit | Change |
|---|---|---|---|
EOF
fi

# --- build the plain-English Change cell (bullets joined with <br>) -----------
cell=""
if [ -s "$NOTE_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="$(printf '%s' "$line" | sed -E 's/^[[:space:]]*[-*•][[:space:]]*//; s/[[:space:]]+$//')"
    [ -z "$line" ] && continue
    if [ -z "$cell" ]; then cell="• $line"; else cell="$cell<br>• $line"; fi
  done < "$NOTE_FILE"
fi
if [ -z "$cell" ]; then
  clean="$(printf '%s' "$SUBJECT" | sed -E 's/^[a-z]+(\([^)]*\))?!?:[[:space:]]*//')"
  clean="$(printf '%s' "${clean:0:1}" | tr '[:lower:]' '[:upper:]')${clean:1}"
  if [ -n "$clean" ]; then
    cell="• $clean"
  else
    cell="• _(no plain-language summary recorded for commit \`$code_sha\` — restore it with \`scripts/version-note.sh amend\`)_"
  fi
fi

row="| $next | $commit_time | \`$code_sha\` | $cell |"

# --- prepend the row after the year ledger's table separator, then commit + tag
tmp="$(mktemp)"
awk -v row="$row" '
  { print }
  !done && /^[[:space:]]*\|[-: |]+\|[[:space:]]*$/ { print row; done = 1 }
' "$year_file" > "$tmp" && mv "$tmp" "$year_file"

touch "$LOCK"
rm -f "$NOTE_FILE"

git add "$year_file"
git commit --no-verify -m "chore(version): v$next" >/dev/null 2>&1
git tag -a "v$next" -m "$SUBJECT" >/dev/null 2>&1
rm -f "$LOCK"

echo "🔖 Recorded version v$next"
