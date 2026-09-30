## Files
LICENSE
package.json
.claude-plugin/plugin.json
.claude-plugin/marketplace.json

## Summary
Added `Copyright (c) 2026 Or Assayag` beneath the unchanged Ludeo line (grep shows both lines 3-4). Added `"author": "Or Assayag"` to package.json. Set plugin.json author and marketplace.json owner + plugin author to Or Assayag. No per-file `Copyright` headers exist under client/, server/, drift-sync/. `claude plugin validate .` passed; `npm run build` green (client + server).

## Commit message
docs(license): credit maintainer alongside Ludeo

Add Or Assayag as a copyright holder and package/plugin author.
Ludeo line and MIT text are untouched; Omer Sher's credit stays in README and LICENSE.

## Key decisions
Plugin manifests changed only the name strings; Ludeo line left intact.

## Open questions
None.
