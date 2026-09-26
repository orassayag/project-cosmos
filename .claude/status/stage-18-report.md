# Stage 18 report — M3 client: computeAskTouches, Map askFocusIds, App action wiring

## Files
client/src/map/askTouches.ts
client/src/map/__tests__/askTouches.test.ts
client/src/map/Map.tsx
client/src/App.tsx
client/src/hooks/useDeepLink.ts
client/src/components/AskPanel.tsx

## Summary
While the Ask panel is open, the map can now light up several services at once, not only one. The glow logic moved into a pure `computeAskTouches(ids, edges)` in `client/src/map/askTouches.ts`. It returns every id plus each one's direct neighbours, or `null` for an empty list. `Map` takes `askFocusIds` (default: a stable empty array) and still memoises the result.

`App` keeps `askFocusIds: string[]`:
- **Disconnected:** each ask sets a one-item list with a random service, the same as before.
- **Connected:** each ask starts with an empty list.

`App` also has a `handleAskAction(action)` handler, ready for stage 19:
- `highlight` replaces the list with the `serviceIds` that are known services or topics.
- `playScenario` resolves the id through the deep-link resolver (scenario or incident) and plays it. Unknown ids are ignored.

The handler is passed to `AskPanel` as `onAction`. `AskPanel` only declares that prop and the `AskAction` type; it does not emit anything yet.

Hand-written files: 6, within the ceiling of 6. About 150 LOC changed or added in total. Every file is well under 300 lines, except `Map.tsx` and `App.tsx`, which were already over that.

| Gate (repo root) | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass: 0 errors, the 2 warnings that were already there (AskPanel.tsx:69, Map.tsx) |
| `npm test` | pass: client 17/17 (5 new, askTouches), server 95/95 |
| `npm run build` | pass |
| `npm run validate` | pass, no drift |

Proof that the tests catch real breakage. A scratchpad script (`mutate.py`) applied each mutation from a backup, ran the test, restored the file, and `diff -q` confirmed the restore. The full suite was green again afterwards.
- M1: `[]` returns an empty `Set` instead of `null` → the "returns null" test fails.
- M2: only the first id seeds and matches, which is the old single-focus behaviour → the "every id plus each neighbourhood" and "dedupes" tests fail.
- M3: edges are followed from the `from` end only → 3 tests fail.
- M4: the ids themselves are not seeded → the "lone touch" test fails.

Mobile: there are no layout, CSS or panel changes. Only the set of dimmed and glowing nodes changes, and it uses the same styling path. No new panel means the close-button contract and the one-card-at-a-time rule are unaffected. No screenshot was taken.

## Commit message
feat(client): let the ask answer highlight several services and play scenarios

The agent names several services per answer, but the map could only light up one
(round-2 I2). Pulled the glow set into a pure, tested computeAskTouches and added App
handlers for the highlight/playScenario stream actions, ready for the stage-19 reader.

## Key decisions
- **API for stage 19:** `AskAction` is exported from `client/src/components/AskPanel.tsx`. It matches the §7 lines exactly: `{ type:'action'; kind:'highlight'; serviceIds: string[] }` | `{ type:'action'; kind:'playScenario'; scenarioId: string }`. `AskPanel` has an optional prop `onAction?: (action: AskAction) => void`. `App` already passes `onAction={handleAskAction}`, so the stream reader only needs to call `onAction(parsedLine)` for each action line. The highlight glow only shows once `onAnswerStart` has fired, as before: `askFocusIds={askAnswering ? askFocusIds : []}`.
- **Reusing the deep-link path:** a new `resolvePlayableId(id)` in `client/src/hooks/useDeepLink.ts` returns the id if it names an incident or a scenario, and `null` otherwise. Deep-link hydration now calls `resolvePlayableId(initial.incident) ?? resolvePlayableId(initial.scenario)`, and `playScenario` calls the same function. From there it goes through the existing `handlePickScenario`, the same one the dropdown uses. One small side effect: `?incident=<scenario id>` (or the other way round) now resolves, where before it was ignored. The incident id still wins.
- **`playScenario` starts playback, not just selection,** to match the server's "Playing *X* for you ▶" text. The runner only exposes the new steps after the next render, so a `pendingAutoplayIdRef` effect in `App` calls `navPlay()` once `state.scenarioId` matches and the steps are loaded. If the scenario is already active, it calls `navRestart()` instead.
- **Highlight filtering:** `serviceIds` are filtered on the client to known `SERVICES_BY_ID`/`TOPICS_BY_ID` ids. The server already validates them, but an unknown id would otherwise dim the whole map. If every id is unknown, the list becomes empty and nothing is dimmed.
- **Signatures:** `computeAskTouches` takes `readonly string[]` and edges shaped as `Pick<EdgeRecord,'from'|'to'>`, so the tests need no map data. The `Map` prop is typed `readonly string[]`, which accepts the plan's `string[]`.

## Open questions
- The `App` action wiring (the highlight replace/filter, `playScenario` autoplay, and the connected versus disconnected starting state) has no unit test. There is no `App` render harness, and extracting a reducer would push the stage past the 6-file ceiling. Stage 19's AskPanel tests, or a manual smoke test, should cover it. The plan's acceptance step 7 ("at least two named services glow") exercises it end to end.
