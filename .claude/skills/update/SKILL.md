---
name: update
description: Triggered by "/update". Summarizes the pending working-tree changes in plain English, records them as the next row in the versions/<year>.md ledger (via the post-commit version hook), then stages the changed paths explicitly, commits with a Conventional Commits message, and pushes with --force-with-lease.
disable-model-invocation: true
argument-hint: "[optional commit subject or type hint, e.g. \"feat: add payments scenario\"]"
---

# /update — summarize, record the version, commit, push

The ledger row is written by `scripts/version-bump.sh` (the local post-commit hook), which
places it at the top of the right `versions/<year>.md` table and tags `vX.Y.Z`. **Never edit
`versions/*.md` by hand** — this skill feeds the hook its plain-English note instead.

## 1. Preflight

```bash
git status --porcelain
git rev-parse --abbrev-ref HEAD
test -x .git/hooks/post-commit || bash scripts/install-hooks.sh
```

- Nothing to commit → stop and say so.
- Mid-rebase/merge (`.git/rebase-merge`, `.git/rebase-apply`, `.git/MERGE_HEAD`) → stop; the
  version hook skips those states.

## 2. Understand the change

Read `git diff`, `git diff --cached`, and any untracked files from `git status`. Skip
files that look like secrets (`.env*`, keys) or debris you didn't create — list them and ask
before including them.

If the diff touched code, run `npm run build` (and `npm run validate` if `src/scenarios/` or
`src/incidents/` changed). A failure is a stop condition — report the output, don't commit.

## 3. Write the version note

Summarize the real changes as **one plain-language bullet per change**, understandable by a
non-developer — no jargon, no file names. Match the tone of existing rows in
`versions/<year>.md`.

```bash
printf '%s\n' "<bullet 1>" "<bullet 2>" | scripts/version-note.sh write
```

## 4. Commit

Stage every path by name — never `git add .`/`-A`/`-u`/`commit -a`.

Subject: `<type>(<scope>): <description>` — imperative, ≤72 chars. Use `$ARGUMENTS` when
given. The type decides the bump: `feat` → minor, `!`/`BREAKING CHANGE` → major, anything
else → patch. Body: 2–3 lines on *why*. End with the session's attribution trailer.

```bash
git add <path> <path> ...
git commit -F - <<'EOF'
<type>(<scope>): <description>

<why, 2-3 lines>
EOF
```

Confirm the hook printed `🔖 Recorded version vX.Y.Z` and that `git log -2 --oneline` shows
the code commit followed by `chore(version): vX.Y.Z`. If no row was recorded, run the hook
by hand: `bash scripts/version-bump.sh`.

## 5. Push

```bash
git push --force-with-lease --follow-tags origin HEAD
```

- No upstream yet → add `-u`.
- On the default branch (`main`) a global hook blocks any force push. Use a plain
  `git push --follow-tags origin HEAD` there; if it's rejected as non-fast-forward, stop and
  report — never rewrite `main`.
- Rejected by the lease (remote moved) → stop and report; do not retry with bare `--force`.

## 6. Report

One short table: version, commit sha, branch, push result, and the ledger bullets.
