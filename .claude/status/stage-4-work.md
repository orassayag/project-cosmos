# Stage 4 — Docs-vs-code audit checklist and mismatch fixes

Plan: docs/plans/unfork-project.md, section "4. Docs-vs-code audit (I6)". Pasted verbatim:

Checklist, each line ticked pass/fail (record results in the commit body or PR description — here: in the report's `## Summary` and `## Commit message` body):
- README commands vs `package.json` scripts.
- Env vars documented vs used in code (`grep -rn "process.env\|import.meta.env"`).
- Routes and keyboard shortcuts vs the UI.
- Folder tree in README/CLAUDE.md vs disk.
- Deploy steps vs `vercel.json` and `.github/workflows/`.

Fix every mismatch found. Done when all lines are ticked and `npm run build`, `typecheck`, `lint`, `validate` are green (and `npm test` if demo docs changed).

Out of scope (plan): removing/altering the Ludeo copyright line or MIT text; renaming the project; drift-sync gating changes; GitHub-side detach (manual step 6); step 5 (version note/commit) is the orchestrator's. Fix docs to match code, not code to match docs, unless the code is clearly the bug. Do not touch versions/*.md.
