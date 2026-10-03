# Stage 2 work brief — P1: Move the data into the server

Plan: docs/plans/server-owned-data-migration-plan.md (pasted verbatim below). No spec for this run.
Scope: Phase 1 ONLY. Do not start Phase 2 (palette/groupServiceId/clusters) or Phase 3 (derive modules). Keep `color` unchanged.

## Ground rules (from the plan)
### Ground rules for the executing agent

- Execute phases in order, one phase per branch or commit series; do not start a phase until the previous phase's acceptance passes. The plan targets v1.33.3+; if paths have moved, re-run the Phase 0 inventory and update paths first.
- `CLAUDE.md` wins on process: Conventional Commits, `scripts/version-note.sh write` before every commit, README check on every commit.
- Gates before every commit: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`. Never run `tsc` without `--noEmit`/`-b`.
- Repo invariants hold throughout: unique global `phaseId`; step `from`/`to`/`via`/`through` resolve; world 2400×1400; capsules ≥150px apart; AstroMart stays fictional.
- UI invariants hold throughout: mobile-first, one panel at a time on phones, top-right close control on every floating panel.
- Demo tours keep working after every phase: `?demo=all` ≤120s, `?demo=ai` ≤60s (`client/src/demo/__tests__/scripts.test.ts` or its current location guards them).
- The AstroMart map must look and behave identically after every phase.
- Ambiguity → smaller change, recorded in `docs/plans/server-owned-data-decisions.md`. Stop conditions are listed at the end.


## Relevant issue resolution — I3 (shapes apiTypes.ts from day one)
| I3 | The type-generation step will not produce the single file the plan expects | gpt | Phase 5 runs `tsc --declaration --emitDeclarationOnly` on `apiTypes.ts`. That file is allowed to import `types.ts`. The TypeScript compiler writes one declaration file (`.d.ts`, a types-only copy of a code file) for every source file it reads, and it names each output after its source. So the command writes `apiTypes.d.ts` and `types.d.ts`, not one `client/src/api/cosmos-api.d.ts`. The `--outFile` option can't combine them for this project's module setting (NodeNext). The CI check (`git diff --exit-code client/src/api/`) would then guard files the client does not import. <br><br> **Before Fix:** The step that should keep the browser and the server agreeing on the data's shape writes the wrong files. The safety check then watches files nobody uses. <br><br> **After Fix:** The browser gets one exact copy of the server's data description, and CI fails the moment the two stop matching. | Fixed | `apiTypes.ts` is self-contained (no imports); `types.ts` re-exports it; `schema.ts` uses `satisfies z.ZodType<CosmosResponse>`; `types:emit` copies the file with a header, no compiler. |

## Phase 1 — verbatim
### Phase 1 — Move the data into the server

Layout:

```
server/src/cosmos/
  apiTypes.ts         # self-contained response + entity types (Phase 5 finalizes)
  types.ts            # re-exports apiTypes.ts; server-only types
  schema.ts           # Zod schemas, each `satisfies z.ZodType<...>`
  data/
    brand.ts domains.ts services.ts topics.ts scenarios.ts
    owners.ts drift.ts health.ts
    steps/ shopping.ts fulfillment.ts engagement.ts
    incidents/ payment-cascade-*.ts inventory-oversell-*.ts hub-silence-*.ts
  validate.ts         # validateCosmos()
  index.ts            # getCosmosData(): one frozen object
```

- Copy each client data module into `data/`, server ESM style (`.js` suffixes, as in `server/src/app.ts`). Nothing under `server/` imports from `client/` or `drift-sync/`.
- Data only; leave `resolveOwner`, `groupServicesByTeam`, `driftEntryMatches`, PR/commit URL builders, `stepsForScenario` and health helpers for Phase 3. Do not copy `steps/core.ts`. Keep `color` unchanged for now.
- Entity types are written directly in `apiTypes.ts` with **no imports** (see Phase 5/I3), and `types.ts` re-exports them — so there is one definition from the start.
- `schema.ts`: Zod schemas checked against the types with `satisfies z.ZodType<T>`. `validate.ts` ports the reference checks from `drift-sync/scripts/validate.ts` and adds: unique `phaseId`, capsules ≥150px apart, incident steps resolve, step `from`/`to`/`via`/`through` resolve to a service, sub-service or topic.
- *Tests:* `server/src/__tests__/cosmosSchema.test.ts` — `getCosmosData()` parses; protects the data shape. `server/src/__tests__/validateCosmos.test.ts` — one case per rule, each with a deliberately broken clone (bad id, duplicate `phaseId`, capsules 100px apart, dangling incident step) asserting a named error; protects every invariant. Unit layer.
- *Parity:* `server/src/__tests__/cosmosParity.test.ts` deep-equals server data against `baseline-full.json`; a client-side twin (`client/src/__tests__/cosmosParity.test.ts`) deep-equals the client copy against the same fixture — so the two copies cannot drift. Temporary; the client half is deleted in Phase 11.
- A3 check added: `phase 1`: nothing under `server/` imports `client/` or `drift-sync/`.

**Acceptance:** `getCosmosData()` matches the baseline; validation catches each deliberately broken case; client unchanged; build green.

## A3 extension point
Add the `phase 1` check to the existing table in `scripts/cosmos-check.ts` (built in stage 1). `npm run cosmos:check -- --phase 1` must be green.

## Stop and ask the owner if (verbatim)
### Stop and ask the owner if

- A Phase 0 baseline command fails on `main`.
- A data value must change to make a test pass — **except** the two Phase 2 changes named above (`color`→`palette`, prefix rule→`groupServiceId`), which are proven by equivalence tests instead.
- Vercel's CDN does not serve a new `version` after a deploy, or cold starts stay slow after lazy imports.
- The gzip size of `/api/cosmos` is over 100 KB (I7).
- The production `version` does not match the build's `COSMOS_VERSION` (I6).
- The digest grows more than 50% and trimming would remove information.
- Any change seems to need a database, write endpoint, auth or shared package.
- A phase would change how the map looks or behaves for a visitor.

## Stage acceptance checklist
- getCosmosData() deep-equals baseline-full.json (server parity test) and the client copy deep-equals it too (client twin parity test).
- validateCosmos.test.ts: one deliberately broken clone per rule, each asserting a named error.
- Nothing under server/ imports client/ or drift-sync/ (A3 phase-1 check green).
- Client source unchanged (only the new client/src/__tests__/cosmosParity.test.ts is added).
- Gates: npm run build, npm run typecheck, npm run lint, npm test, npm run validate, npm run cosmos:check -- --phase 1, npm run parity:screens (map unchanged).
