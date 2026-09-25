#!/usr/bin/env bash
# The plain-English side of the version ledger: write the note BEFORE a commit, or
# repair a row AFTER one. Bullets always arrive on stdin, one per line (a leading
# "-"/"*"/"•" is optional and stripped).
#
#   scripts/version-note.sh write
#       Writes .git/version-note.md, which version-bump.sh consumes on the next
#       commit to build that version's Change cell. Equivalent to writing the file
#       by hand; exists so the two halves live in one documented place.
#
#   scripts/version-note.sh amend [<version>]
#       Rewrites an ALREADY-RECORDED row's Change cell in versions/<year>.md and
#       stages the file. Defaults to the newest row. This is the recovery path for a
#       row that was written without a note — the ledger says "never edit by hand"
#       because rows must not be invented, and restoring the summary the hook should
#       have written is the opposite of inventing one.
#
# Exit status: 0 = done, 1 = nothing on stdin / row not found, 2 = usage error.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 2

NOTE_FILE=".git/version-note.md"
MODE="${1:-}"

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

# Reads stdin, strips bullet markers and blank lines. Prints one cleaned bullet per line.
read_bullets() {
  sed -E 's/^[[:space:]]*[-*•][[:space:]]*//; s/[[:space:]]+$//' | grep -v '^[[:space:]]*$'
}

case "$MODE" in
  write)
    bullets="$(read_bullets)"
    [ -n "$bullets" ] || { echo "version-note: nothing on stdin — no note written." >&2; exit 1; }
    printf '%s\n' "$bullets" | sed 's/^/• /' > "$NOTE_FILE"
    echo "Wrote $NOTE_FILE ($(printf '%s\n' "$bullets" | grep -c .) bullet(s)) — consumed by the next commit."
    ;;

  amend)
    target="${2:-}"
    bullets="$(read_bullets)"
    [ -n "$bullets" ] || { echo "version-note: nothing on stdin — nothing amended." >&2; exit 1; }

    cell="$(printf '%s\n' "$bullets" | awk '{ printf "%s• %s", (NR > 1 ? "<br>" : ""), $0 } END { print "" }')"

    year_file="$(ls -1 versions/[0-9][0-9][0-9][0-9].md 2>/dev/null | sort | tail -1)"
    if [ -n "$target" ]; then
      year_file="$(grep -l "^| ${target} |" versions/[0-9][0-9][0-9][0-9].md 2>/dev/null | head -1)"
    fi
    [ -n "$year_file" ] && [ -f "$year_file" ] || {
      echo "version-note: no ledger row found${target:+ for version $target}." >&2; exit 1; }

    tmp="$(mktemp)"
    awk -v cell="$cell" -v target="$target" '
      # The Change cell is everything after the third column separator. Matching only
      # the row PREFIX (version | time | commit |) keeps any "|" inside the cell itself
      # from confusing the split.
      !done && /^\|[[:space:]]*[0-9]+\.[0-9]+\.[0-9]+[[:space:]]*\|/ {
        if (target == "" || $0 ~ ("^\\|[[:space:]]*" target "[[:space:]]*\\|")) {
          if (match($0, /^\|[^|]*\|[^|]*\|[^|]*\|/)) {
            print substr($0, 1, RLENGTH) " " cell " |"
            done = 1
            next
          }
        }
      }
      { print }
      END { if (!done) exit 3 }
    ' "$year_file" > "$tmp" || {
      echo "version-note: could not locate the row to amend in $year_file." >&2; rm -f "$tmp"; exit 1; }
    mv "$tmp" "$year_file"

    git add "$year_file"
    echo "Amended ${target:-the newest row} in $year_file and staged it — commit it as its own change."
    ;;

  ''|-h|--help) usage ;;
  *) echo "version-note: unknown mode '$MODE'" >&2; usage ;;
esac
