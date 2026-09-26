# Stage 14 work brief — §5: classify.ts (JEV evaluate, 3s timeout, fallback, warn-once) + classify.test

Stage line: §5: classify.ts (JEV evaluate, 3s timeout, fallback, warn-once) + classify.test

## Scope for this stage
- Add `ai` >= 7.0.105 to `server/` dependencies (for `experimental_evaluate`).
- `server/src/agent/classify.ts`: JEV evaluate call (per §5 below), 3s timeout, fallback to `localRelevance` on gateway error / timeout / missing `AI_GATEWAY_API_KEY` (missing key skips the evaluate call entirely), single `JEV_UNAVAILABLE` warning at first use (warn-once, not per request). Output must be a `RouteInput` (stage 13's `route.ts`) so it feeds `decideRoute` directly.
- `server/src/agent/__tests__/classify.test.ts` per the Tests section below (only the classify.test bullets are in scope; route/localRelevance tests exist already).
- NOT in scope: `/api/ai/ask` route (stage 17), agent graph (stage 16), context digest (stage 15).

## Plan §2 excerpt (env behaviour)
- Environment variables (Vercel project, Production + Preview): `AI_GATEWAY_API_KEY` (already held), and `AI_COOKIE_SECRET` (32 random bytes, base64; generate with `openssl rand -base64 32`). Neither variable stops the server from starting — the map needs no AI:
  - `AI_COOKIE_SECRET` is required only by the routes that read or write the cookie (`connect`, `status`, `ask`). When it is missing they return `503 { errorCode: 'AI_NOT_CONFIGURED' }` and log one error; `disconnect` still clears the cookie. The client treats `AI_NOT_CONFIGURED` from `status` as disconnected and hides the Connect button.
  - `AI_GATEWAY_API_KEY` missing → classification uses the free `localRelevance` fallback (§5) with a single `JEV_UNAVAILABLE` warning at first use, not per request.

## Plan §5 (verbatim)
### §5 — Classification with JEV (the free gate before any paid call)

**Package:** `ai` ≥ 7.0.105 (adds `experimental_evaluate`) in `server/`. Model id `'typesafe-ai/jev'` as a plain string, so AI SDK routes it through AI Gateway using `AI_GATEWAY_API_KEY`. Pass `providerOptions: { gateway: { zeroDataRetention: true } }`, because visitor questions should not be retained. Cost is $0.042 per 1M input tokens, paid by the site owner, with no output charge. The visitor spends nothing on classification.

One `evaluate` call per question. All questions are evaluated in parallel, so this is one round-trip:

```ts
const classification = await evaluate({
  model: 'typesafe-ai/jev',
  state: { question, serviceNames, topicNames, domainNames },
  questions: {
    onTopic: {
      type: 'boolean',
      instructions: 'Is this question about the AstroMart system shown on the map — its services, topics, flows, teams, or incidents?',
      criteria: { true: 'About the map/architecture', false: 'Unrelated (weather, jokes, general trivia, other companies)' },
    },
    intent: {
      type: 'choice',
      instructions: 'What does the visitor want?',
      criteria: {
        explainFlow: 'How something works or what happens when X',
        findService: 'Which service/topic does or owns something',
        playScenario: 'Wants to see a flow play on the map',
        incident: 'About a past production incident',
        ownership: 'Which team owns something',
      },
    },
    targetScenario: {
      type: 'choice',
      instructions: 'Which scenario best matches the question, if any?',
      criteria: { none: 'No specific scenario', ...scenarioCriteriaFromSnapshot },
    },
  },
  providerOptions: { gateway: { zeroDataRetention: true } },
});
```

`state` carries names only, never the full snapshot, which keeps the input small (the "keep state focused" guidance). `targetScenario` options are generated from `cosmos-map.json`, with one entry per scenario (id → title). There are 8 today, well under the 255-option limit.

**Routing decision** (`server/src/agent/route.ts`, a pure function)
- `onTopic.probability < 0.35` → **off-topic**: return a random line from `OFF_TOPIC_ANSWERS`, the same self-aware humour as today's `DEMO_ANSWERS` ("I only know about stars on this map — for the weather, try looking up. ☁️"). The visitor's model is not called.
- `intent = playScenario` **and** `targetScenario ≠ none` with probability ≥ 0.6 → a **direct action**: stream a short templated line ("Playing *Checkout* for you ▶") and a `playScenario` action. The visitor's model is not called.
- Otherwise → **agent** (§6), with `intent` and `targetScenario` passed in as hints.

**Fallback when JEV is unavailable** (gateway error, timeout > 3s, or `AI_GATEWAY_API_KEY` not set — the last one skips the `evaluate` call entirely): run `localRelevance(question, snapshot)`. This is a free check that is on-topic when the question contains any service, topic, domain, team, or scenario name, or an architecture word from a short fixed list. Off-topic → funny reply; on-topic → agent. **The fallback never calls the visitor's model to classify.** That is the I6 guarantee, and a warning log (`JEV_UNAVAILABLE`) makes spikes visible.

**Abuse guard (proportionate):** `/api/ai/ask` returns `401 NOT_CONNECTED` before calling JEV when there is no valid cookie, so the owner's gateway key is only spent for visitors who have already proved they own a working provider key. Set a monthly budget on the AI Gateway key in the Vercel dashboard. That is a one-time manual step, listed in the hand-off.

**Tests** — `server/src/agent/__tests__/`
- `route.test.ts`: a table of classification results mapped to decisions, covering the threshold edges (0.34 / 0.35, 0.59 / 0.6). *Protects: the off-topic and direct-action rules never drift.*
- `classify.test.ts`, with `evaluate` stubbed to throw: the question falls back to `localRelevance`, the visitor-model stub is **never called** for an off-topic question, and a `JEV_UNAVAILABLE` warning is logged. *Protects: the zero-visitor-token promise holds without JEV (I6's adversarial case).*
- `classify.test.ts` also covers `AI_GATEWAY_API_KEY` unset: `evaluate` is never called, `localRelevance` decides, and the warning is logged once across two questions.
- `localRelevance.test.ts`: "what's the weather" → off; "what does payments-gateway do" → on.


## Relevant issue resolutions (verbatim)
| I1 | "JEV" is not a known tool | Claude | Fixed | JEV is TypeSafe AI's classification model on Vercel AI Gateway (`typesafe-ai/jev`, via AI SDK `experimental_evaluate`), authenticated with the existing `AI_GATEWAY_API_KEY`. See Design §5. |
| I6 | "Unrelated questions cost zero tokens" breaks when JEV is not set up | Claude (adversarial) | Fixed | JEV classifies on the site owner's gateway key, so the visitor spends nothing. The fallback is a free keyword check and never the visitor's model. JEV also supplies intent and target scenario. Design §5. |
| I12 | Server imports must end in `.js` on Vercel (see L016) | bank | Fixed | `.js` on every relative import under `server/`, enforced by the server's `moduleResolution: NodeNext`. Design §3. |
| I1 | A missing gateway key crashes the server instead of using the free fallback | Claude | Fixed | Only `AI_COOKIE_SECRET` is required, and only by the cookie routes; a missing gateway key falls back to `localRelevance`. `server/.env.example` + README local setup. Design §2, §3, §5. |
| I1 | A missing gateway key crashes the server instead of using the free fallback | Claude | Fixed | Only `AI_COOKIE_SECRET` is required, and only by the cookie routes; a missing gateway key falls back to `localRelevance`. `server/.env.example` + README local setup. Design §2, §3, §5. |
