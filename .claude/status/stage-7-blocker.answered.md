# Stage 7 — decision needed: parity:screens scenario framing

`npm run parity:screens` passes 8/16 views; the 8 scenario/incident views differ by 0.10–0.27% (threshold 0.1%).

- Baselines were retaken with a deterministic harness from the **pre-Phase-7** App.tsx/main.tsx (reproduces them 3/3).
- The Phase 7 build shows the deep-linked scenario framed ~1 px to the side at the same zoom (e.g. 145%); identical
  on every run, so it is real, not flake. Non-scenario views (default, blast, health, ownership, drift, changelog,
  realtime-hub, mobile) are unchanged.
- Cause not found: the framing fit (`useMapView.fitTo`) measures the SVG rect when the shell mounts, which now happens
  after `/api/cosmos` answers instead of on the first render.

Options:
1. Accept the 1 px shift as invisible and rebaseline the 8 views from the Phase 7 build (`npm run parity:screens -- --update --only <views>`).
2. Keep the gate failing and have me (or Phase 8) chase the 1 px cause first.
# Stage 7: parity:screens framing. Cause found, but no fix passes the current baselines

## What I found (measured; probe script in gitignored `parity-out/probe.mjs`)
- `useMapView.fitTarget` (`client/src/hooks/useMapView.ts:101`) sizes the fit from `svg.getBoundingClientRect()`. That rect includes the `.lc-stage` reveal keyframe `transform: scale(1.04 → 1)` (`client/src/styles/app.css:43-52`, 1.4 s on the shell's first mount). So a fit made during the reveal measures an inflated rect.
- The harness never freezes this animation. The freeze `<style>` that `parity-screens.mjs` appends to `documentElement` in an init script is gone once the page has parsed: 0 matching style tags, and `lc-stage-reveal` runs live. CSS animations therefore play on the real clock.
- **Pre-Phase-7:** the deep-link fit measures one real frame into the reveal. The rect is 1990 px wide (scale 1.0365) and the final world scale is 1.26024.
- **Phase 7:** the fit runs in the same frame the shell mounts. The rect is 1996.8 px wide (scale 1.04) and the final scale is 1.26175. That ~0.1% scale/offset difference is the 1 px shift.
- **The baselines record a race.** With CPU throttling, the pre-Phase-7 build frames the same deep link differently:

  | CPU throttle | Rect width | Final scale |
  |---|---|---|
  | ×1 | 1990 px | 1.2602 |
  | ×4 | 1977 px | 1.2573 |
  | ×8 | 1955 px | 1.2523 |

  The Phase 7 build gives 1996.8 px / 1.2618 at ×1, ×4 and ×8, so it is deterministic. The current baselines record what one CPU speed produced.

## Why I did not patch
To match the baselines, client code would have to measure after about 16 ms of real-time reveal progress. No deterministic change does that, and a timer or rAF hack would be the guess-patch you ruled out. Each correct fix changes framing, so it needs a rebaseline, which you forbade:

1. **Client fix (recommended).** Have `fitTarget` use the SVG's untransformed layout size (`clientWidth`/`clientHeight`, or divide out the stage transform). Framing then ignores the reveal on every machine. It changes the default-map home fit and every scenario/incident fit. Rebaseline all 16 views.
2. **Harness fix.** Make the freeze apply, for example by injecting it on `DOMContentLoaded` or via `page.route` HTML rewrite. The reveal then never transforms during a shot. The client stays untouched, but the same views change and need a rebaseline. It can be combined with 1.
3. **Accept Phase 7 as-is.** Rebaseline only the 8 scenario/incident views from the Phase 7 build. That build is deterministic across CPU speeds, unlike the current baselines.

Decision needed: pick 1, 2, 1+2 or 3. Every option needs a rebaseline.
