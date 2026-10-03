# Contributing to Project Cosmos

Thanks for wanting to make the galaxy bigger. Two rules of the universe before you start:

1. **The map is data.** Almost everything lives in `server/src/cosmos/data/` — services, topics, scenarios, steps; the client renders it from `GET /api/cosmos`. If your change is "the demo should show X", it's probably a data change, not a code change.
2. **Never run `tsc` without `--noEmit`** (or `-b`). Stray `.js` files shadow `.tsx` in Vite (`client/`) and the app silently serves stale code.

## Dev setup

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # typecheck + production build (all workspaces) — must pass before a PR
pnpm typecheck  # typecheck only (all workspaces)
pnpm validate   # data sanity checks (ids resolve, phaseIds unique, spacing, palette, …)
pnpm fixture:cosmos  # regenerate the client test fixture after any data edit
pnpm lint       # eslint — must pass before a PR
pnpm test           # client + server + scripts tests
pnpm test:e2e   # Playwright: loads the map through /api/cosmos
```

The server is required: the client holds no domain data and renders whatever `GET /api/cosmos` returns. While `pnpm dev` runs, an edit under `server/src/cosmos/data/` restarts the server and the open map updates within about 2 seconds.

A data change also updates two pinned copies in the same PR: the client fixture (`pnpm fixture:cosmos`) and, for the changed entries, `server/src/__tests__/fixtures/baseline-full.json`, which `server/src/__tests__/cosmosParity.test.ts` compares the data with. If you change `server/src/cosmos/apiTypes.ts`, run `pnpm types:emit`.

## Data invariants (the ones that bite)

- `phaseId` is **global and never reused** — steps are filtered by phase; a collision plays the wrong steps.
- Every step's `from`/`to`/`via`/`through` must exactly match a `SERVICES[].id` or `TOPICS[].id` — typos silently drop edges.
- A service's `hex` must equal `PALETTE[service.palette]` (SVG gradients can't read CSS vars).
- Keep ≥150px center-to-center spacing between capsules.

If you use [Claude Code](https://claude.com/claude-code), the repo ships with two skills that enforce all of this: `/add-service` and `/add-scenario`.

## Pull requests

- Fork → feature branch → PR against `main`.
- `pnpm lint`, `pnpm build`, `pnpm test` and `pnpm validate` must pass (CI checks them, plus the API-types freshness check, a drift-sync typecheck and the Playwright load test).
- One logical change per PR. Screenshots/GIFs for anything visual are hugely appreciated.
- New scenario for the AstroMart demo? Great — keep it fictional, keep payloads plausible, and showcase at least one mechanic (kafka `via:`, broadcast `through:`, `parallel:`, split storage hops).

## Reporting bugs / proposing features

Open an issue with repro steps (bugs) or the problem you're trying to solve (features). "It would be cool if…" is a valid problem statement here.
