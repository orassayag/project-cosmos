# Stage 7 report — §5/§6/§9: scripted answer, `demo=ai` script, timing tests

## Files
client/src/demo/scriptedAnswer.ts
client/src/demo/__tests__/scriptedAnswer.test.ts
client/src/demo/scripts.ts
client/src/demo/__tests__/scripts.test.ts

## Summary
The AI demo now has its full script and its fixed answer. The answer (67 words) explains, in fictional AstroMart terms, that placing an order goes through storefront and api-gateway (Shopping team), then orders, payments and inventory (Fulfillment team), and finally realtime-hub and notifications (Engagement team) — taken from the "Place an order" flow and the team ownership data. It highlights those seven services on the map as it starts. It thinks for 1.5s and shows one word every 90ms, so it finishes in about 7.5s, inside the 8.5s answer step.

The `demo=ai` script follows the plan's table exactly: 14 steps, 29.3s total, with the planned captions, and a pointer target on every step that clicks something.

Tests check that every highlighted service exists on the map and is named in the text, that the answer fits its step, that the AI demo stays under 60s, that every step kind has a matching app callback, that every pointer target is a known one, and (the check deferred from stage 3) that playing the whole AI demo with fake timers never calls `fetch`.

Checks: `npm run typecheck` clean; `npm run lint` 0 errors (1 pre-existing warning in `client/src/map/Map.tsx`, untouched); client tests 93/93 pass (12 files); `npm run build` succeeds.

## Commit message
feat(demo): add the scripted AI demo and its fixed answer

The ai demo needs a fixed ~30s script and an answer that stays true to the
map. Tests lock the 60s limit, callback and target coverage, and prove the
full run never makes a network request.

## Key decisions
- `scriptedAnswer.ts` exports `DEMO_QUESTION`, `DEMO_ANSWER_SERVICE_IDS`, and `DEMO_SCRIPTED_ANSWER` (a module-level constant, so it is referentially stable — satisfies stage 6's identity note as long as stage 8 passes this same object through `playAnswer`).
- `scripts.ts` exports `AI_DEMO_SCRIPT`, `DEMO_SCRIPTS`, `DEMO_TIME_LIMITS_MS`, `scriptDurationMs`. `DEMO_SCRIPTS` and `DEMO_TIME_LIMITS_MS` are `Partial<Record<DemoModeName, …>>` for now. **Stage 12:** add `ALL_DEMO_SCRIPT`, `all: 120_000`, and switch both to full `Record<DemoModeName, …>`; the tests already iterate every entry in `DEMO_SCRIPTS`, so `all` gets the limit/target checks automatically.
- **Stage 8:** look up the script via `DEMO_SCRIPTS[mode]`. The `closeConnect` step has no `target` (no close-button id exists in `DEMO_TARGETS`); the pointer stays where it was.
- Pasted keys are obviously fake (`sk-ant-demo-astromart-0000`, `jev-demo-astromart-0000`); they are only displayed, never sent.
- The plan says the question is 69 characters; the verbatim question is actually 67. I kept the plan's wording and did not assert the length.

## Open questions
None.
