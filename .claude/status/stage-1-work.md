# Stage 1 work brief — Licence and authorship metadata

Plan: docs/plans/unfork-project.md (no spec). Branch feature/add-ai. Ledger so far: empty.

## Plan tasks (pasted)
### 1. Licence and authorship (I1, I5)
- `LICENSE`: keep `Copyright (c) 2026 Ludeo` and the full MIT text unchanged; add `Copyright (c) 2026 Or Assayag` on the line beneath it.
- `package.json`: add `"author": "Or Assayag"`.
- `.claude-plugin/plugin.json:6` and `.claude-plugin/marketplace.json:4,11`: set `owner`/`author` to Or Assayag. Omer Sher's credit lives in README and `LICENSE`.
- Preserve any per-file copyright headers (grep for `Copyright` under `client/`, `server/`, `drift-sync/`; expected none to change).
- Verify: no test layer applies (static metadata). Check `grep -n Copyright LICENSE` shows both lines; `claude plugin validate .` if available; `npm run build` green.

Out of scope: removing/altering the Ludeo line or MIT text; README/SECURITY wording (stage 2); hooks (stage 3).
Note: the versioning ledger under versions/ is generated — never edit by hand. Do not touch docs/status/*.
