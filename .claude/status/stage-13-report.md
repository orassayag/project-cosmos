# Stage 13 report — demo recorder

## Files
scripts/record-demo.mjs
package.json
package-lock.json
.gitignore

## Summary
Added `scripts/record-demo.mjs` and the root npm script `record:demo` (`npm run record:demo -- ai|all`). It launches headless Playwright Chromium at 1920×1080 with `recordVideo` and opens `${BASE_URL:-http://localhost:5173}/?demo=<mode>`. It then waits until `<html data-demo-state>` is `done` or `aborted`. The wait limit is the mode's time limit plus 30s (90s for ai, 150s for all). On `done` the video is saved to `recordings/demo-<mode>.webm`. The script exits non-zero in four cases: the elapsed time is over 60s (ai) or 120s (all), the demo aborts, the wait times out, or the mode is missing or invalid. It also exits non-zero with a clear usage message when the app can't be reached; that message names `npm run dev` and `BASE_URL`. `playwright@^1.63.0` is now a root devDependency, and `recordings/` is in `.gitignore`.

Checks:
- **Real runs**, against a dev server I started on port 5188 and stopped afterwards:
  - `ai` finished in 30.1s (limit 60s), exit 0. Video: `recordings/demo-ai.webm`, about 2.6 MB.
  - `all` finished in 117.4s (limit 120s), exit 0. Video: `recordings/demo-all.webm`, about 10 MB.
  - Both files are gitignored.
- **Error paths:** no mode, `foo`, and an unreachable `BASE_URL` each print a clear message and exit 1.
- **`npm run lint`:** 0 errors. The one warning is the old one at `Map.tsx:814`.
- **`npm run typecheck`:** clean.
- **`npm test`:** client 133/133 and server 95/95 passed.

Not verified:
- I did not watch either video to check it against the §6/§7 tables. That is stage 14.
- I did not test the `aborted` path, because nothing sends trusted input in a headless run.
- `npx playwright install chromium` was denied by the permission system. The matching Chromium build (1243) was already cached in `~/Library/Caches/ms-playwright`, so the runs used that. A fresh machine needs `npx playwright install chromium` once.

## Commit message
feat(demo): add record:demo Playwright recorder with real-time limits

The unit test only sums script durations; scenario playback runs on the
app's own clock, so a wall-clock recording run is the real backstop for
the 60s/120s demo limits and produces the shareable videos.

## Key decisions
- **Limits are hard-coded** as `TIME_LIMITS_MS = { ai: 60_000, all: 120_000 }` in the recorder. They copy `DEMO_TIME_LIMITS_MS` in `client/src/demo/scripts.ts`, which is TypeScript inside the client workspace, so plain Node can't import it. A comment in the recorder names the source.
- **"Elapsed"** runs from just before `page.goto` until `html[data-demo-state="done|aborted"]` is seen, so it includes page load. That is what a viewer of the video sits through.
- **Timing margin for `all` is tight.** The real run took 117.4s, which leaves 2.6s under the limit (the script total is 116.6s, plus about 0.8s for load). A slower machine or a cold Vite first compile could go over. For stage 14, run the recorder once to warm Vite before the acceptance run, or expect a few hundred ms of extra variance.
- **Speed is always 1.** The recorder passes no `?speed=`, as stage 12 advised.
- **Video handling:**
  - Playwright writes to a temporary folder `recordings/.tmp-<mode>-<pid>`, which is removed in `finally`.
  - On `done`, the video is saved as `demo-<mode>.webm`. This happens even when the run is over the limit, so you can look at it, but the exit code is still 1.
  - On aborted or timeout, no video is saved, so a good recording from an earlier run is never overwritten by a failed one.
- **The browser runs headless.** The ai video starts from page load and ends at `done`, so the end card is visible in the last frames.
- **Stage 14: port 5173 is already taken.** An existing Vite process, started from the repo root, is listening there and returns 404 on `/`. It is not mine, so I didn't stop it. `npm run record:demo` against the default URL will fail until that process is replaced by a working `npm run dev`. The other option is to start the client on another port and pass `BASE_URL`, as I did here.
- **README not updated:** it has no obvious section for recording.

## Open questions
None.
