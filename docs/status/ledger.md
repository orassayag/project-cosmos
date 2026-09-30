# Master Run Ledger
Plan: docs/plans/unfork-project.md

## Stage 1 — Licence and authorship metadata (committed 2026-09-30 17:14)
**Files:** LICENSE, package.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json
**What was built:** Added `Copyright (c) 2026 Or Assayag` beneath the unchanged Ludeo line; set Or Assayag as author in package.json, plugin.json, and marketplace.json owner/plugin author.
**Key decisions:** Ludeo line and MIT text untouched; plugin manifests changed only name strings. No per-file copyright headers exist in client/, server/, drift-sync/.
**User overrides during review:** None.

## Stage 2 — Fork wording removal and "Origin & credits" (committed 2026-09-30)
**Files:** README.md, SECURITY.md
**What was built:** Removed the "About this fork" block and the "fork of" line; added one "Origin & credits" section (ludeo-labs/cosmos-os, MIT, notice preserved in LICENSE, Medium link, list of additions) plus a top pointer. "off by default on forks" is now "off by default". License footer credits Ludeo and Or Assayag.
**Key decisions:** Additions list moved into Origin & credits rather than duplicated. Ludeo copyright and MIT text untouched. `grep -niE fork README.md SECURITY.md` is empty; `npm run build` passed.
**User overrides during review:** None.
