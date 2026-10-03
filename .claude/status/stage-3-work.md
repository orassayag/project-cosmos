# Stage 3 work brief — P2: Move hardcoded domain knowledge into data

Plan: docs/plans/server-owned-data-migration-plan.md (Phase 2 only). Branch: feature/add-ai. No spec file.

## Plan — ground rules (verbatim)
### Ground rules for the executing agent

- Execute phases in order, one phase per branch or commit series; do not start a phase until the previous phase's acceptance passes. The plan targets v1.33.3+; if paths have moved, re-run the Phase 0 inventory and update paths first.
- `CLAUDE.md` wins on process: Conventional Commits, `scripts/version-note.sh write` before every commit, README check on every commit.
- Gates before every commit: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`. Never run `tsc` without `--noEmit`/`-b`.
- Repo invariants hold throughout: unique global `phaseId`; step `from`/`to`/`via`/`through` resolve; world 2400×1400; capsules ≥150px apart; AstroMart stays fictional.
- UI invariants hold throughout: mobile-first, one panel at a time on phones, top-right close control on every floating panel.
- Demo tours keep working after every phase: `?demo=all` ≤120s, `?demo=ai` ≤60s (`client/src/demo/__tests__/scripts.test.ts` or its current location guards them).
- The AstroMart map must look and behave identically after every phase.
- Ambiguity → smaller change, recorded in `docs/plans/server-owned-data-decisions.md`. Stop conditions are listed at the end.

## Plan — Issue I4 (verbatim, applies to this phase)
| I4 | Phase 2 has to change existing values, which the plan forbids | Claude (adversarial) | Phase 2 replaces each service's `color: 'var(--svc-cyan)'` with a `palette: 'cyan'` key. It also replaces topic grouping by name prefix with an explicit `groupServiceId`. Both remove or change values that `baseline-full.json` records. But Phase 2 says "existing values must not change", and the stop list says to stop whenever "a data value must change to make a test pass". If the executing agent follows the plan exactly, it either stops at Phase 2 or keeps `color` forever, and then the coupling to `tokens.css` the phase set out to remove stays. <br><br> **Before Fix:** The plan's own rules contradict each other at Phase 2. The migration either stalls or quietly leaves the old color setup in place. <br><br> **After Fix:** Phase 2 can finish, and tests prove the colors and groupings still look exactly the same. | Fixed | Phase 2 names exactly two allowed fixture changes (`color`→`palette`, prefix rule→`groupServiceId`), each proven by an equivalence test; the stop rule carves out these two. |

## Plan — Phase 2 (verbatim)
### Phase 2 — Move hardcoded domain knowledge into data

Find every case:

```
grep -rEn "storefront|api-gateway|'cart'|'search'|catalog|inventory|'orders'|payments|shipping|notifications|object-storage|realtime-hub|hub-|orders\.|payments\.|shopping\.|fulfillment\.|engagement\.|AstroMart" client/src --include=*.ts --include=*.tsx | grep -v __tests__ | grep -v 'client/src/scenarios/\|client/src/incidents/'
```

| Hardcoded today | Where | New data |
| --- | --- | --- |
| Cluster membership lists | `ShoppingCluster.tsx`, `UICluster.tsx`, `EngagementCluster.tsx`, fourth `*Cluster.tsx` | `clusters: Cluster[]` with `id`, `label`, `serviceIds`, plus hardcoded geometry/styling |
| Nebula anchor ids and colors | `NebulaField.tsx` | `nebula` on each `Cluster` (anchor ids, palette key) |
| `realtime-hub` ecosystem (`hub-ingest`, `hub-presence`, `hub-push`, `hub-broadcasts` internal edges) | `Map.tsx`, `edge-resolver.ts` | `ecosystem` on `Service`: `expandable`, `internalEdges` |
| `storefront` and other special cases | `edge-resolver.ts`, `Map.tsx` | A field named after the behavior (e.g. `role: 'entry'`) |
| Topic grouping by name prefix, alias `hub`→`realtime-hub` | `topic-groups.ts` | Explicit `groupServiceId` on each `Topic`; prefix rule and alias deleted |
| `color: var(--svc-cyan)` coupling to `tokens.css` | `services.ts`, `tokens.css` | `palette: 'cyan' \| …`; keep `hex`. Validation rejects unknown keys |

- Add types/schemas/values on the server; make the identical change in the client copy so both parity tests keep passing.
- Refactor each component to read the field. The client maps `palette` → `var(--svc-<key>)` itself; `tokens.css` stays client-owned.
- **Allowed fixture changes (I4).** Regenerate `baseline-full.json` with exactly these changes and no others: (1) new fields added (`clusters`, `nebula`, `ecosystem`, `role`, `groupServiceId`, `palette`); (2) `color` removed from services, replaced by `palette`; (3) the prefix-derived `TOPIC_GROUPS` input replaced by explicit `groupServiceId`. Keep the pre-Phase-2 fixture as `baseline-full.phase0.json` for the equivalence tests. Review the fixture diff; any other changed value is a stop condition.
- *Equivalence tests (I4):* `server/src/__tests__/phase2Equivalence.test.ts` — for every service, `` `var(--svc-${service.palette})` `` equals `phase0.SERVICES[id].color`, and `palette`'s hex matches the old `hex`; topic groups built from `groupServiceId` deep-equal `phase0.TOPIC_GROUPS`. Protects identical colors and grouping. Unit layer. Mirror the color check in the client parity twin.
- *Component test:* `client/src/map/__tests__/clusters.test.tsx` renders a cluster from fixture data with a renamed member id and asserts the member renders — protects the "rename needs no client code" boundary. Component layer.
- A3 check added: `phase 2`: the grep above returns only data files, tests and `client/src/demo/` (until Phase 9).
- `npm run parity:screens` green.

**Acceptance:** screenshots match baseline; equivalence tests pass; `npm run cosmos:check -- --phase 2` green.

## Plan — stop-and-ask list (verbatim)
### Stop and ask the owner if

- A Phase 0 baseline command fails on `main`.
- A data value must change to make a test pass — **except** the two Phase 2 changes named above (`color`→`palette`, prefix rule→`groupServiceId`), which are proven by equivalence tests instead.
- Vercel's CDN does not serve a new `version` after a deploy, or cold starts stay slow after lazy imports.
- The gzip size of `/api/cosmos` is over 100 KB (I7).
- The production `version` does not match the build's `COSMOS_VERSION` (I6).
- The digest grows more than 50% and trimming would remove information.
- Any change seems to need a database, write endpoint, auth or shared package.
- A phase would change how the map looks or behaves for a visitor.
