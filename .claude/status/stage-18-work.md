# Stage 18 work brief — M3 client: computeAskTouches extract, Map askFocusIds, App action wiring (highlight + playScenario) + askTouches.test

## Stage scope
Client-only (`client/`). No server changes. No AskPanel stream reader (that is stage 19).
- Extract `askTouches` (`client/src/map/Map.tsx`, around the plan's cited `:700-711` — line numbers may have drifted) into a pure, exported `computeAskTouches(ids, edges)` in a new file under `client/src/map/` (camelCase `.ts` per naming rules, e.g. `askTouches.ts`). Seeds the set with every id and adds the neighbours of each; returns `null` for `[]`. `Map.tsx` uses it (keep memoisation as today).
- `Map` prop `askFocusId?: string | null` → `askFocusIds?: string[]` (default `[]`). Update every consumer inside `Map.tsx` that read `askFocusId` (glow/focus styling, camera, etc.) so every id glows, not only the first.
- `App.tsx`: `askFocusId` state → `askFocusIds: string[]`. Disconnected `handleAsk` keeps today's behaviour as a one-element list with the random id. Prop passed to `Map` becomes `askFocusIds={askAnswering ? askFocusIds : []}`.
- Action wiring, ready for stage 19 to call: add App-level handlers for the two §7 action events — `{type:'action',kind:'highlight',serviceIds}` replaces `askFocusIds` with `serviceIds`; `{type:'action',kind:'playScenario',scenarioId}` starts that scenario through the SAME selection path `client/src/hooks/useDeepLink.ts` uses (reuse/extract that path — do not write a parallel one). `scenarioId` may be a scenario OR an incident id (server `play_scenario` accepts both) — handle both, mirroring how deep links resolve incidents. Unknown ids are ignored safely. Expose them to `AskPanel` as a prop (e.g. `onAskAction(action)`) with a typed client `AskAction` union matching the §7 lines exactly; when connected, `askFocusIds` starts empty at the beginning of an ask. AskPanel itself does not yet emit actions (stage 19 wires the reader) — only accept/forward the prop if needed for types; keep the AskPanel diff minimal.
- Tests: `client/src/map/__tests__/askTouches.test.ts` — two ids yield both ids plus both neighbourhoods; `[]` yields `null`; (reasonable extras: unknown id, overlapping neighbourhoods dedupe). If the playScenario/highlight reducer logic is extracted pure, a small test for it is welcome but optional. Non-vacuous proof via mutations, as prior stages did.
- Mobile-first invariant: verify nothing in the glow/focus change regresses at ~390px (no new panel is added, so the close-button contract is untouched). A screenshot is not required if no layout changes; say so in the report.
- Out of scope: AskPanel stream reader, usage line, error messages, INVALID_KEY disconnect (stage 19).

## Plan text (pasted verbatim from docs/plans/add-ai.md)

### §6 — Client side of actions
- `client/src/map/Map.tsx`: the prop `askFocusId?: string | null` (`Map.tsx:126`, default at `:160`) becomes `askFocusIds?: string[]` (default `[]`). `askTouches` (`Map.tsx:700-711`) seeds its set with every id and adds the neighbours of each; it returns `null` when the list is empty.
- `client/src/App.tsx`: `askFocusId` state (`App.tsx:371`) becomes `askFocusIds: string[]`. When disconnected, `handleAsk` keeps today's behaviour as a one-element list with the random id. When connected, it starts empty and each `highlight` action replaces it with the received `serviceIds`. The prop passed at `App.tsx:625` becomes `askFocusIds={askAnswering ? askFocusIds : []}`.
- `playScenario` goes through the same selection path the deep-link hook uses (`client/src/hooks/useDeepLink.ts`) to start a scenario.

### §6 — Tests (client row)
- `client/src/map/__tests__/askTouches.test.ts` (extract `askTouches` into a pure `computeAskTouches(ids, edges)` in `client/src/map/` so it is testable without rendering the SVG): two ids yield both ids plus both neighbourhoods; `[]` yields `null`. *Protects: every service the agent names glows, not just the first (round-2 I2).*

### §7 — Streaming protocol (action lines)
```
{"type":"action","kind":"highlight","serviceIds":["checkout","payments-gateway"]}
{"type":"action","kind":"playScenario","scenarioId":"checkout"}
```

### Round-2 I2
| I2 | The map can only light up one star, but the agent sends several | Claude (adversarial) | Fixed | `Map` takes `askFocusIds: string[]`. Design §6; acceptance step 7 tightened. |

### Final acceptance step 7 (context)
Ask "what happens when a payment fails?": the answer streams, **at least two named services glow**, and a usage line appears.
