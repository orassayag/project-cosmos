# Stage 6 report — P6: Agents read the full model

## Files
README.md
client/src/api/cosmos-api.ts
client/src/__tests__/askUnknownAction.test.ts
docs/plans/server-owned-data-decisions.md
scripts/cosmos-check.ts
server/src/__tests__/agentEval.test.ts
server/src/__tests__/askRoute.test.ts
server/src/__tests__/cosmosMap.test.ts
server/src/__tests__/cosmosParity.test.ts
server/src/agent/__tests__/classify.test.ts
server/src/agent/__tests__/context.test.ts
server/src/agent/__tests__/graph.test.ts
server/src/agent/__tests__/localRelevance.test.ts
server/src/agent/__tests__/route.test.ts
server/src/agent/askAnswer.ts
server/src/agent/context.ts
server/src/agent/graph.ts
server/src/agent/mapActionTools.ts
server/src/agent/mapSnapshot.ts
server/src/agent/readTools.ts
server/src/agent/systemPrompt.ts
server/src/agent/types/cosmosMapSnapshot.ts
server/src/app.ts
server/src/cosmos/apiTypes.ts
server/src/cosmos/schema.ts
server/src/cosmos/view.ts

## Summary
The AI agent now reads `getCosmosView()` instead of `cosmos-map.json`. `app.ts` passes the view to `answerQuestion`. Triage and routing use a snapshot built from the view, and that snapshot is checked to equal the old file exactly. The digest gains an `As of` line, one health/on-call line per service and a latest-drift summary. It went from 1,942 to 2,607 cl100k tokens (+34%, under the 50% limit; 7,584 → 9,321 chars). The agent gains six read tools (`get_service`, `get_steps`, `blast_radius`, `who_owns`, `on_call`, `drift`) and five map actions (`show_blast_radius`, `open_passport`, `show_health`, `show_ownership`, `open_changelog_entry`), with every id checked against the view.

`derived.asOf` (2026-08-14) was added to the API types, the Zod schema and the emitted client copy. A mocked-LLM eval passes all four plan questions. A client test proves that unknown actions do nothing.

Gates, all green:
- `npm run build` (COSMOS_VERSION=e14ae1d530f1cc30)
- `npm run typecheck`
- `npm run lint`: 0 errors, plus the 1 known warning at Map.tsx:821
- `npm test`: client 189, server 333, scripts 5
- `npm run validate`: 0 issues
- `npm run cosmos:check`: 19/19, including the new phase 6 checks

The file count (26) is over the 10-file ceiling. The acceptance grep forces seven existing tests to stop importing the JSON, and the plan asks for the eval, the client test, types, the schema, emitted types, the check script, the README and the decisions log. Each of those edits is small.

## Commit message
feat(agent): read the cosmos view, add read tools and view map actions

The agent answered from a separate cosmos-map.json snapshot, so it could not see health, drift
or payloads, and it could drift away from the map. It now reads getCosmosView(), gains read
tools and map actions checked against the view, and measures relative time from derived.asOf.

## Key decisions
- **`asOf` lives in `derived`, not `data`.** It is computed as the later of `health.asOf` and the latest drift run, so putting it in `data` would duplicate two facts. No data value changed. The payload gains one field and the `version` changes.
- **The snapshot is a projection of the view.** `agent/mapSnapshot.ts` builds `CosmosMapSnapshot` from the view, and `cosmosParity.test.ts` checks it deep-equals `baseline-cosmos-map.json`. So `classify.ts`, `localRelevance.ts` and `route.ts` are untouched and behave the same. `graph`, `context` and `mapActionTools` take the view directly.
- **Tests that imported the JSON** now use `getMapSnapshot()`, because the acceptance grep covers tests too. Their assertions are unchanged except where behaviour is meant to change:
  - the graph test now expects 13 bound tools (map actions first, then read tools);
  - the askRoute test expects `view`.
- **The phase 6 cosmos:check greps `generated/cosmos-map\.json`** with the parity test excluded. Two comments still mention the old file name.
- **New NDJSON action kinds:** `showBlastRadius {nodeId}`, `openPassport {nodeId}`, `showHealth`, `showOwnership`, `openChangelogEntry {entryId}`. Phase 8 must handle exactly these names. Today the client's `parseAskStreamLine` turns them into `null`, so they do nothing.
- **`who_owns` on a topic** returns the owners of the services that publish it. **`on_call`** for a service with no health row falls back to its team's rotation; a service with no team returns null.
- **`drift` uses `searchDrift`**, which matches one substring. The tool description tells the model to send a single keyword.
- **Digest budget.** `context.test.ts` caps the digest at 11,376 chars (1.5× the baseline) and checks that no step payload appears in it. Tokens were measured with `js-tiktoken` in a temporary test that has since been removed. `js-tiktoken` is only a transitive dependency, so the permanent suite does not use it.
- **No `demo=ai` change.** The visible Ask behaviour is the same: the new actions do nothing on the client, and the scripted demo answer is fixed text. Phase 8 should show the new actions in the tours once they do something.
- **Not verified here:** whether a real model picks these tools. The plan's live four-question check with a real key is still a manual step.
