# Stage 14 report — Final acceptance

## Files

None. This stage only ran checks and changed no project files. The one new file is this report.

## Summary

Every item on the Final acceptance list passes, and no code had to change. I ran all checks from the repo root on branch `feature/add-ai`. The client ran on my own dev server at `:5188`, and the recorder got `BASE_URL=http://localhost:5188`. I left the unrelated process on `:5173` alone, and I stopped my `:5188` server before finishing.

| Acceptance item | Result | Measured |
|---|---|---|
| `npm run typecheck` | PASS | exit 0 in both workspaces |
| `npm run lint` | PASS | exit 0, 0 errors, 1 warning (`client/src/map/Map.tsx:814` exhaustive-deps, already there before this plan) |
| `npm test` | PASS | client: 18 files, 133 tests. server: 13 files, 95 tests. All green. |
| `npm run build` | PASS | exit 0 (only Vite's usual warning about chunk size) |
| `record:demo -- ai` under 60s | PASS | warm-up 30.0s, timed run 30.0s, exit 0, wrote `recordings/demo-ai.webm` |
| `record:demo -- all` under 120s | PASS | warm-up 117.2s, timed run 117.2s, exit 0, wrote `recordings/demo-all.webm`. 2.8s under the limit. |
| `ai` sequence matches the §6 table | PASS | see "How the sequences were checked" below |
| `all` sequence matches the §7 table | PASS | see "How the sequences were checked" below |
| Site without `?demo=` works as before | PASS | details below |
| Real click mid-demo stops it, app usable after | PASS | details below |
| §10 at 390×844 portrait | PASS | 0 problems found |
| §10 at 844×390 landscape | PASS | 0 problems found |

**How the sequences were checked.** ffmpeg is not installed, so I could not pull frames from the `.webm` files. Instead I ran a separate Playwright script (1920×1080) on both demos. It read the page state every 100ms: caption, active domain, Ask text, Connect window fields and button label, Search pressed, answer panel, step and incident panels, Ownership toggle, end card, and `data-demo-state`. It also took about 12 screenshots for `ai` and 22 for `all`, and I looked at them myself.
- **`ai`:** each step starts at the time the table predicts (running total plus about 0.4s of page load):
  - settle
  - "Exploring the Shopping domain" at 1.2s
  - typing starts at 2.4s, question complete at 5.7s
  - Connect window opens with Claude selected at 7.0s
  - Claude key pasted at 8.9s
  - JEV key at 9.9s
  - button reads "Connecting…" at 10.5s
  - window closes at 13.0s
  - Search pressed at 13.4s
  - answer panel at 13.5s, "The agent answers from the live map" at 14.2s
  - end card at 25.7s
  - `done` at 29.8s

  Screenshots show the pointer on the key field, the finished answer with the 7 services highlighted, and the end card.
- **`all`:** the order matches §7:
  - intro pressed, warp done by 3.2s
  - domains Shopping, then Fulfillment at 6.9s, then Shopping at 9.8s
  - "Place an order" plays steps 01 through 11, from 12.4s to about 57s
  - step back 11→10→9, then forward 9→10→11 (57.5–67s)
  - incident "Realtime-hub silence" plays 1/4 through 4/4 (67.6–83s)
  - Ownership legend on at 83.6s, off at 91.0s
  - shortened AI segment runs 93.6–113s (type, Connect, keys, connect, ask, answer)
  - end card at 113.0s
  - `done` at 117.0s

  The segment lengths are the stage-12 lengths (116.6s total). They differ from the plan's 111s, as the ledger already notes.

**Site without `?demo=`** (fresh browser storage, 1440×900):
- The intro shows.
- No `data-demo-state` attribute, and no demo pointer or caption.
- No `/api/ai/*` request fires before the intro. Pressing "Jump in" fires one real `GET /api/ai/status`.
- `cosmos-intro-seen` is stored as before.
- Asking a question gives a joke answer plus the "Connect an AI agent for real answers." prompt, with no `/api/ai/ask` request.

**Stopping a demo with a click** (`?demo=ai`, a real Playwright `mouse.click` about 2.5s after the Connect window opened, with both keys already pasted):
- 0.8s later: `data-demo-state="aborted"`, Connect window closed, Ask box reset (empty and editable again), no answer panel, pointer removed, caption strip empty, no end card.
- 6s later it is still aborted and nothing reopened.
- Clicking the Fulfillment tab afterwards makes it the active domain.
- Asking a question afterwards gives the normal joke answer.
- No `/api/ai/*` request fired during the demo. Only the real status re-check fired, after the abort.

**§10 phones** (`?demo=ai&speed=4`, `hasTouch` and `isMobile`, page state checked every 40ms for the whole run, screenshots at each key moment, all inspected):
- The page reports `data-viewport="mobile"` and `data-touch="true"`.
- The Connect window and the answer panel were never visible at the same time.
- The caption was never visible while the Connect window, answer panel or end card was open.
- The pointer was never visible.
- The end card's close button sits in its top-right corner:
  - portrait: card spans x 16–374, button x 325–359
  - landscape: card spans x 162–682, button x 633–667
- Tapping the close button closes the end card.

**AI requests during the demo.** In both `ai` and `all`, the only `/api/ai/*` request was `GET /api/ai/status`. It fired at the moment the run reached `done` (117.0s in `all`), when App switches back to the real connection. That is the §3 "switch back to realAi, which re-checks" behaviour. Nothing touched the AI server while a demo was running.

**Not verified:**
- I did not watch the saved `.webm` files, because ffmpeg is missing. The sequence checks above come from separate live runs with the same URL, viewport and speed, not from the recorded files.
- I only checked phones with Chromium device emulation, not a real iOS or Android device or Safari.
- Only Chromium was tested.

**Things I noticed that do not block acceptance (no fix made):**
1. **Landscape Connect window cuts off the button (844×390).** With the demo-only JEV field showing, the Connect button falls below the window's visible area. The window scrolls on phones (`max-height: 88dvh; overflow-y: auto`), so nothing breaks, but a phone viewer does not see the "Connecting…" state. The JEV field never shows outside the demo, so real visitors are not affected.
2. **The scripted answer ignores `?speed=`.** Its thinking time and per-word timing are not divided by speed. At `speed=4` the answer is still being written when the end card opens. On phones the panel sits behind the card, so closing the card shows a partly written answer that then finishes. At `speed=1` (recordings) it finishes in time. A5 only asks for speed scaling in the runner, pointer and caption, so this is not a failure.
3. **The `all` demo keeps the incident's step and incident panels open** through the Ownership and AI segments. This is the app's normal behaviour after an incident plays, and on desktop the panels do not collide.

## Commit message

```
test(demo): run final acceptance for the ai and all demo tours

Checks the finished demo end to end in a real browser: both recordings stay
under their time limits, the timelines match the plan's tables, a real click
stops a demo cleanly, and the normal site (intro, status check, joke answer) is unchanged.
```

## Key decisions

- I checked the §6 and §7 sequences by reading page state and taking screenshots in separate live Playwright runs, because ffmpeg is not installed. The recorder runs were used only for the real timing.
- I warmed Vite with one throwaway run of each mode before the timed runs. The warm and timed runs came out the same (30.0s and 117.2s).
- I ran the client with `npm run dev --workspace client -- --port 5188 --strictPort`. `npm run dev:client -- --port …` drops the flags when npm nests the call. My first try ended up on port 5174, and I stopped it right away.
- I did not treat the `/api/ai/status` request at the end of a demo as a failure, because the plan asks for that re-check once the real connection takes over. I recorded its exact timing.
- The three things listed above under "Things I noticed" are outside the acceptance list and the plan's scope, so I reported them and changed nothing.

## Open questions

- Should the landscape Connect window (844×390) scroll the Connect button into view during the demo's `connect` step, or should the demo-only JEV field be made smaller on short screens? Either change is cosmetic and optional.
- Should `?speed=` also speed up the scripted answer's thinking time and word reveal, so fast rehearsal runs finish the answer before the end card?
