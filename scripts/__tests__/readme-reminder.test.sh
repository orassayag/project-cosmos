#!/usr/bin/env bash
set -euo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/readme-reminder.sh"
workDir="$(mktemp -d)"
trap 'rm -rf "$workDir"' EXIT
failures=0

runCase() {
  local caseName="$1" message="$2" stagedFiles="$3" expectWarning="$4"
  local messageFile="$workDir/msg" output exitCode=0
  printf '%s\n' "$message" > "$messageFile"
  output="$(README_REMINDER_STAGED_FILES="$stagedFiles" bash "$SCRIPT" "$messageFile" 2>&1)" || exitCode=$?
  local hasWarning=false
  if [[ "$output" == *"gh repo edit"* ]]; then hasWarning=true; fi
  if [ "$exitCode" -ne 0 ] || [ "$hasWarning" != "$expectWarning" ]; then
    echo "FAIL: $caseName (exit=$exitCode, warning=$hasWarning, expected warning=$expectWarning)"
    failures=$((failures + 1))
  else
    echo "ok: $caseName"
  fi
}

runCase "feat without README warns" "feat(ai): add ask panel" "client/src/a.ts" true
runCase "feat with README is silent" "feat(ai): add ask panel" $'client/src/a.ts\nREADME.md' false
runCase "fix without README is silent" "fix(map): correct edge" "client/src/a.ts" false
runCase "breaking bang warns" "refactor!: drop old api" "client/src/a.ts" true
runCase "BREAKING CHANGE footer warns" $'chore: bump\n\nBREAKING CHANGE: new format' "client/src/a.ts" true
runCase "docs/README.md does not count as README" "feat: x" "docs/README.md" true

if ! bash "$SCRIPT" "$workDir/does-not-exist"; then
  echo "FAIL: missing message file returned nonzero"
  failures=$((failures + 1))
else
  echo "ok: missing message file exits 0"
fi

if [ "$failures" -eq 0 ]; then echo "all passed"; else echo "$failures failed"; exit 1; fi
