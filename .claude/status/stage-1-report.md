# Stage 1 report

## Files
client/src/demo/types.ts
client/src/demo/demoMode.ts
client/src/demo/__tests__/demoMode.test.ts

## Summary
Added the demo-mode foundation: `types.ts` defines the full step union (all §1 and §7 kinds, each with `durationMs`, optional `caption` and `target`), the `DemoTarget` union for every A1 pointer target, and the `DemoActions` callback interface. `demoMode.ts` adds `readDemoMode` (only `ai`/`all`, speed clamped 1–8, default 1) and `shouldShowIntro`, which never writes storage. `demoMode.test.ts` covers ai/all/unknown modes, speed clamping, the intro rule for all three cases, the no-write guarantee, and that every domain has a pointer target.
Verification: `npm run typecheck` clean; `npm run lint` 0 errors (1 existing warning in `Map.tsx`, not touched); `npm --prefix client test` 8 files / 49 tests passed.

## Commit message
feat(demo): add demo step types and demo-mode URL parsing

Later demo stages (runner, pointer, scripts, App wiring) build on one shared
step/target/action contract, so it is defined up front. A bad `?demo=` value
returns null so the app loads as normal, and the intro helper cannot write storage.

## Key decisions
- `DEMO_TARGETS` and `DEMO_STEP_KINDS` are runtime `as const` arrays, and `DemoTarget` / `DemoStepKind` come from them. `DEMO_STEP_ACTIONS: Record<DemoStepKind, (keyof DemoActions)[]>` maps each kind to the callbacks it drives (`wait` → `[]`). The §9 `scripts.test.ts` can check coverage against these arrays at runtime.
- Target ids (the `data-demo-target` values stage 10 must add): `intro-start`, `domain-shopping|fulfillment|engagement`, `ask-input`, `ask-search`, `connect-open`, `connect-provider-anthropic|openai`, `connect-provider-key`, `connect-jev-key`, `connect-submit`, `playback-play`, `playback-step-back`, `playback-step-forward`, `legend-ownership`. Domain targets are listed by hand because `Domain['id']` is a plain `string`. A test checks that every `DOMAINS` id has one.
- `DemoStep` is a discriminated union with a payload for each kind: `pickDomain{domainId}`, `type{text}`, `pickProvider{provider: AiProvider}`, `paste{field: 'providerKey'|'jevKey', value}`, `ask{question}`, `answer{answer: DemoScriptedAnswer}`, `playScenario{scenarioId}`, `openIncident{incidentId}`, `toggleLegend{isVisible}`. `toggleLegend` sets the legend explicitly instead of flipping it, so the result is always the same.
- `DemoActions` has: `pressIntro`, `pickDomain`, `setQuestion`, `openConnect`, `pickProvider`, `setConnectField`, `setAiStatus(DemoAiStatus)`, `closeConnect`, `setSearchPressed`, `ask`, `playAnswer`, `playScenario`, `stepBack`, `stepForward`, `openIncident`, `toggleLegend`, `showEndCard`. The `ask` kind drives `setSearchPressed` + `ask`, and `connect` drives `setAiStatus` (`disconnected → connecting → connected`).
- `DemoAiStatus = 'disconnected' | 'connecting' | 'connected'` is separate from the app's `AiConnectionStatus`, which has no `connecting` state. Stage 3 maps it (`connecting` → the modal's `isBusy`).
- `DemoScriptedAnswer { text; thinkingMs; wordMs; actions?: AskAction[] }` lives in `types.ts`, so stage 5 (`AskPanel.scriptedAnswer`) and stage 7 (`scriptedAnswer.ts`) share one type.
- `shouldShowIntro(demoMode, storage: Pick<Storage,'getItem'>, hasDeepLink = false)`: the optional third argument makes the `null` case match App.tsx exactly (`no deep link && !cosmos-intro-seen`). Stage 8 should pass `initial.scenario != null || initial.incident != null || initial.domain != null`. `demo=all` always returns true, even if the intro was seen before, because the script's first step presses the intro button. `INTRO_SEEN_STORAGE_KEY` is exported so App can reuse it.
- `DemoMode` / `DemoModeName` types live in `types.ts`.
