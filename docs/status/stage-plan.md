# Master Stage Plan
Plan: docs/plans/unfork-project.md
Branch: feature/add-ai
Review budget: 120 minutes
Generated: 2026-09-30

## Scope estimate
~250 LOC estimated across ~12 files (mostly metadata/docs edits, one shell hook + test) → 4 stages, ~60 LOC/stage average, well under the ceilings. Plan step 6 (GitHub detach) is manual and outward-facing, so it is not a stage.

## Stages
- Stage 1: COMMITTED — Licence and authorship metadata (LICENSE, package.json, plugin manifests)
- Stage 2: COMMITTED — Fork wording removal and "Origin & credits" (README, SECURITY)
- Stage 3: COMMITTED — README/GitHub-description reminder hook + shell test + install-hooks wiring
- Stage 4: PLANNED — Docs-vs-code audit checklist and mismatch fixes
