## Files
README.md
SECURITY.md

## Summary
Removed the "About this fork" block and the "This repository is a fork of" line. Added one "Origin & credits" section (ludeo-labs/cosmos-os, MIT, notice preserved in LICENSE, Medium link, the full list of additions) and a one-line top pointer to it. "off by default on forks" is now "off by default" in README and SECURITY. The License footer credits Ludeo and Or Assayag. `grep -niE fork README.md SECURITY.md` returns nothing. `npm run build` passed.

## Commit message
docs(readme): replace fork wording with Origin & credits section

The repo is no longer presented as a fork. One credits section keeps the
Cosmos OS/Ludeo attribution and MIT notice, and the license footer now
matches LICENSE.

## Key decisions
- Moved the additions list into Origin & credits rather than duplicating it.
- Kept a short blockquote pointer at the top of the README.
- Ludeo copyright and MIT text untouched.

## Open questions
None.
