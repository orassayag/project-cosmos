# Stage 6 work brief — P6: Agents read the full model

Plan: docs/plans/server-owned-data-migration-plan.md (Phase 6). Pasted verbatim below.

### Ground rules for the executing agent

- Execute phases in order, one phase per branch or commit series; do not start a phase until the previous phase's acceptance passes. The plan targets v1.33.3+; if paths have moved, re-run the Phase 0 inventory and update paths first.
- `CLAUDE.md` wins on process: Conventional Commits, `scripts/version-note.sh write` before every commit, README check on every commit.
- Gates before every commit: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`. Never run `tsc` without `--noEmit`/`-b`.
- Repo invariants hold throughout: unique global `phaseId`; step `from`/`to`/`via`/`through` resolve; world 2400×1400; capsules ≥150px apart; AstroMart stays fictional.
- UI invariants hold throughout: mobile-first, one panel at a time on phones, top-right close control on every floating panel.
- Demo tours keep working after every phase: `?demo=all` ≤120s, `?demo=ai` ≤60s (`client/src/demo/__tests__/scripts.test.ts` or its current location guards them).
- The AstroMart map must look and behave identically after every phase.
- Ambiguity → smaller change, recorded in `docs/plans/server-owned-data-decisions.md`. Stop conditions are listed at the end.

### Phase 6 — Agents read the full model

Reading the data:
- Replace the `cosmos-map.json` import in `server/src/app.ts` and every agent module (`context.ts`, `classify.ts`, `localRelevance.ts`, `mapActionTools.ts`, `graph.ts`) with `getCosmosView()`.
- Digest stays small: add a short latest-drift summary and one health/on-call line per service; no payloads.
- Measure digest tokens before/after; record both. Growth >50% → trim; if trimming would remove information → stop and ask.
- Add `asOf` (latest drift/health date) to the data; the system prompt measures relative times from `asOf`.

Read tools (LangGraph, pure over the view): `get_service(id)`, `get_steps(playableId)`, `blast_radius(nodeId)` (same result as the `B` overlay), `who_owns(id)`, `on_call(serviceId)`, `drift(query?, since?)`.

Map actions (`mapActionTools.ts`, ids validated against the view): keep `highlight_services`, `play_scenario`; add `show_blast_radius(nodeId)`, `open_passport(nodeId)`, `show_health()`, `show_ownership()`, `open_changelog_entry(entryId)`. First confirm the current client ignores unknown actions safely — add `client/src/__tests__/askUnknownAction.test.ts` asserting an unknown action is a no-op (protects the gap until Phase 8). Component layer.

Evaluation — `server/src/__tests__/agentEval.test.ts`, mocked LLM as existing tests do, asserting tool calls and returned ids:
- "What changed in the Fulfillment Galaxy over the past 24 hours?" → `drift`, names `shipping.dispatched` and `giftWrap` entries.
- "What breaks if payments goes down?" → exactly `blastRadius['payments']`.
- "Who is on call for payments?" → matches health data.
- "What does the checkout request body look like?" → the step payload.
Existing classifier and relevance tests pass unchanged.

**Acceptance:** four eval questions pass; existing agent tests pass; no `cosmos-map.json` importer in `server/src/` except the parity test. A3 check added: `phase 6`: that grep.


## Related plan text

| Digest raises AI cost | Token budget check (Phase 6); payloads via tools |

Stop list (relevant): The digest grows more than 50% and trimming would remove information. A data value must change to make a test pass. Any change seems to need a database, write endpoint, auth or shared package. A phase would change how the map looks or behaves for a visitor.

A3 (cosmos:check): add a `phase 6` entry — grep that no file in server/src/ imports cosmos-map.json except the parity test.

Phase 8 later adds client handlers for the new map actions (Ask panel map actions row) — this stage only adds the server-side actions plus the client unknown-action no-op test.
