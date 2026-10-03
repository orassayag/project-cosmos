# Stage 5 report — P4 + P5: GET /api/cosmos, lazy AI imports, COSMOS_VERSION, types:emit

## Files
.github/workflows/validate-on-pr.yml
README.md
docs/plans/server-owned-data-decisions.md
package.json
scripts/cosmos-check.ts
server/package.json
server/src/app.ts
server/src/cosmos/apiTypes.ts
server/src/cosmos/schema.ts
server/src/cosmos/view.ts
server/src/__tests__/cosmosRoute.test.ts
server/src/__tests__/cosmosIsolation.test.ts
server/scripts/print-cosmos-version.ts
server/scripts/emit-client-types.ts
server/scripts/__tests__/emitClientTypes.test.ts
client/src/api/cosmos-api.ts

## Summary
**Files ceiling:** 16 files, over the guide of 10. Phases 4 and 5 together need a route, 2 server tests, 2 scripts with a test, a generated client file, package/CI wiring, cosmos:check entries, README and the decisions log. Largest file is `schema.ts` at about 370 lines, under the 400 ceiling.

**Phase 4 (route)**
- `GET /api/cosmos` in `server/src/app.ts` returns `{ version, data, derived }`. `data` and `derived` are exactly `getCosmosView()`.
- `server/src/cosmos/view.ts` adds `getCosmosResponseBody()`, which builds the version and serialized JSON once per process, and `getCosmosVersion()`. The version is the first 16 hex chars of the sha256 of the serialized view.
- Response headers are `ETag: "<version>"` and `Cache-Control: public, max-age=60, s-maxage=31536000, stale-while-revalidate=86400`. A matching `If-None-Match` gets a 304 (accepts a list, a `W/` prefix, or `*`).
- `answerQuestion` is now `await import()`ed inside `POST /ai/ask`. It was the only static path to LangChain, LangGraph, `ai` and the provider SDKs.
- `server/scripts/print-cosmos-version.ts` runs at the end of the server `build` script and prints `COSMOS_VERSION=<version>`. Local value: `8dd1bb04e4445ec8`.
- Gzip size is **35,290 bytes (~34.5 KB)**, well under 100 KB. `playable.stepsById` is kept, and a test now enforces the budget.

**Phase 5 (client types)**
- `CosmosResponse` added to the import-free `apiTypes.ts`.
- `schema.ts` gains strict Zod schemas for every derived type, plus `CosmosResponseSchema satisfies z.ZodType<CosmosResponse>`.
- New root script `npm run types:emit` (`server/scripts/emit-client-types.ts`). It rejects any `import` or `export … from` line and writes header + source byte for byte to `client/src/api/cosmos-api.ts`.
- A new CI step runs `types:emit` then `git diff --exit-code client/src/api/cosmos-api.ts`.
- `cosmos:check` gains 4 phase-4 and 4 phase-5 entries.
- README updated: route row, script row and CI description.

**Tests added**
- `cosmosRoute.test.ts` (7): full shape parses with `CosmosResponseSchema` and equals the view; exact headers; 304 variants; 200 on a stale ETag; gzip budget; version format and memo.
- `cosmosIsolation.test.ts`: agent modules, `@langchain/*` and `ai` are mocked to throw on load, and `/api/cosmos` still returns 200.
- `emitClientTypes.test.ts` (7): output equals header + source; 4 import/re-export forms are rejected; an "imports" comment is allowed; the committed client copy equals a fresh emit.

**Gates** (all on `feature/add-ai`, uncommitted tree)
- `npm run build`: ✅ (prints `COSMOS_VERSION=8dd1bb04e4445ec8`)
- `npm run typecheck`: ✅ (covers the `satisfies`, and the client compiles `cosmos-api.ts`)
- `npm run lint`: ✅ 0 errors, 1 pre-existing warning (`Map.tsx:821`)
- `npm test`: ✅ client 182, server 312 (was 297), scripts 5
- `npm run validate`: ✅ 0 errors
- `npm run cosmos:check`: ✅ 17/17 across all phases, including phase 4 and phase 5
- Version-change check: a temporary `brand.helpTitle` edit gave `03999d8489c264ac`; after reverting, `8dd1bb04e4445ec8` again.
- `parity:screens` not run, because no client behaviour changed: `cosmos-api.ts` is types only and nothing imports it.

## Commit message
feat(server): serve the cosmos view at GET /api/cosmos and emit its types to the client

The client will soon fetch one CDN-cached JSON instead of computing the map itself, so the server
now owns the HTTP contract (ETag/304, long s-maxage) and the response types it copies to the client.
The AI stack loads lazily so a broken agent can never take the map down.

## Key decisions
- **Response shape:** the payload is `getCosmosView()` as it is now.
  - `data.demo` is missing (it arrives in Phase 9).
  - Extra keys stay: `palette`/`steps` in `data`; `serviceLinks`/`topicLinks`/`dependentsOf`/`driftLinks` in `derived`.
  - Logged in the decisions file.
- **Hand-written ETag matching** instead of Hono's `etag` middleware, because the middleware re-hashes the body on every request.
- **Only `askAnswer` is lazy.** The cosmos-map.json snapshot import stays static: it is plain JSON, and Phase 11 replaces it.
- **Client runtime guard deferred to Phase 7.** There is no client fetch layer yet, and this stage must not wire the client to fetch.
- **One `apiTypes.ts` comment reworded** (it named `realtime-hub`), because its client copy would fail the Phase 2 AstroMart-name grep.
- **No version note written** (the orchestrator owns it).

## Open questions
- **Manual preview checks (not done, no deploy allowed):**
  1. On a Vercel preview, the second `GET /api/cosmos` should show `x-vercel-cache: HIT`.
  2. A second preview built from a data change should serve a new `version`.
  3. The preview build log should contain `COSMOS_VERSION=…`. Not verified that Vercel Services runs the server workspace's `build` script.
  4. Cold-start time after the lazy import is unmeasured. If it is slow, stop and ask before splitting the function.
- The CI `git diff --exit-code` step only catches a stale copy once `client/src/api/cosmos-api.ts` is committed, because it is untracked now. Locally, `emitClientTypes.test.ts` already fails on a stale copy.
