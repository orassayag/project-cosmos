# Stage 13 work brief — A4: scripts/record-demo.mjs, `record:demo` npm script, playwright devDependency, recordings/ gitignored

Plan: docs/plans/demo-plan.md (no spec file for this run). Stage-plan line:
"A4: scripts/record-demo.mjs, `record:demo` npm script, playwright devDependency, recordings/ gitignored"

## Plan §8 A4 — pasted verbatim

- **A4 — Recorder.** `scripts/record-demo.mjs` (`npm run record:demo -- ai|all`), with
  `playwright` as a root devDependency. It opens `${BASE_URL:-http://localhost:5173}/?demo=<mode>`
  at 1920×1080 with `recordVideo`, waits for `html[data-demo-state="done"]`, and saves the video
  to `recordings/demo-<mode>.webm` (gitignored). It **exits non-zero if the real elapsed time is
  over 60s or 120s**, which is the real-time check for §9. Verify: run it for both modes.

## Plan §9 — Time limits (I9) — pasted verbatim

`client/src/demo/__tests__/scripts.test.ts` builds both scripts and sums `durationMs`. It
asserts `ai ≤ 60_000` and `all ≤ 120_000`. It also asserts that every step `kind` has a handler
in `DemoActions`, and every `target` exists in the `DemoTarget` union. *Protects: a timing edit
cannot silently push a demo over its limit.* Unit layer. The A4 recorder is the real-time
backstop, because the scenario playback in §7 runs on the app's own clock.

## Plan §10 — Screens — relevant line

The demo is **recorded on desktop (1920×1080)**.

## Plan Final acceptance — relevant line (verified fully in stage 14, not here)

- `npm run record:demo -- ai` and `-- all` both finish under their limits and produce videos
  that match the §6 and §7 tables.

## Carry-overs from the ledger (stage 12)

- Recorder should use speed 1 (`?speed=` does not affect scenario/incident playback).
- `html[data-demo-state="done"]` lands ~116.6s after load for `all` (~29.3s for `ai`); the
  wait timeout needs headroom (e.g. 150s) — but the elapsed-time check itself stays 60s / 120s.
- `data-demo-state` can also become `aborted` — the recorder must fail fast on that, not hang.
- The end card stays open after `done`.

## Notes for this stage

- Limits should come from a single place; `client/src/demo/scripts.ts` exports
  `DEMO_TIME_LIMITS_MS` but it is TS inside the client workspace — the .mjs recorder may
  hard-code 60_000 / 120_000 if importing is impractical (say which in Key decisions).
- Decide what "elapsed" measures (page navigation → `done`) and document it.
- Playwright's `recordVideo` writes a random filename; the script must move/save it to
  `recordings/demo-<mode>.webm` after `context.close()`.
- Invalid/missing mode → non-zero exit with a clear usage message.
- If the dev server isn't running, fail with a clear message naming `npm run dev` / `BASE_URL`.
- Actually installing playwright (npm install -D playwright at root) and the chromium browser
  (`npx playwright install chromium`) is in scope. Try a real run of `npm run record:demo -- ai`
  against a started dev server if feasible; if the environment can't (no browser download,
  etc.), say so plainly — stage 14 does the full acceptance runs.
- Update README only if there is an obvious place for recorder usage; otherwise leave it.
