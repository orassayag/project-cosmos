# Plan: Replay a Production Incident

## Goal

Let anyone open Cosmos, pick a past production incident, and press play.  
The map then shows the exact path the failing request (or cascade) took, with the real payloads that were captured at the time.

No AI is used at any point. Everything is based on human-curated, structured files.

---

## Why this is useful

- Post-mortems become visual instead of “who remembers what happened?”
- New team members can understand real past failures without reading long documents.
- Tribal knowledge (“that weird cascade in March”) becomes something you can actually replay.

---

## Core idea (no AI)

An incident is just another playable flow, stored the same way normal scenarios are stored today.

- Normal scenarios live in `src/scenarios/`
- Incident recordings live in a new folder: `src/incidents/`

Each incident is a plain TypeScript file that looks very similar to a scenario, but is frozen in time and marked as an incident.

---

## What an incident file contains

Every incident file holds:

- A short title (e.g. “Payment cascade – 2026-03-12”)
- Date and approximate time the incident started
- A one- or two-sentence human note explaining what went wrong
- The list of hops (from service → to service / topic)
- The real (or carefully redacted) payloads that were seen at each hop
- Optional: links to the original logs or ticket (just plain text URLs)

That’s it. No smart analysis, no automatic summarization, no AI.

---

## How a person creates an incident recording

1. After an incident is resolved, someone who has the logs opens the existing scenario that is closest to the failing path (or starts from a blank one).
2. They copy the relevant steps and replace the example payloads with the real ones from the logs.
3. They add the title, date, and a short note.
4. They save the file under `src/incidents/`.
5. That’s the whole process. It can be done in 10–30 minutes for a typical incident.

No special tooling is required beyond a text editor and the existing Cosmos type-checking.

---

## What the user sees in the UI

### New section in the top header panel
- A simple list called **Incidents**
- Sorted by date (newest first)
- Each item shows the title + date
- Let's have 3 different incidents demos

### When you select an incident
- The normal scenario player switches to “Incident mode”
- A small banner at the top says: “Replaying incident from [date] — [short note]”
- Play / pause / step buttons work exactly like normal scenarios
- The comet flies the recorded path
- The step panel shows the real payloads that were captured

### Visual differences (so people don’t confuse it with a normal scenario)
- Slightly different comet color or a small “incident” badge
- The banner mentioned above

Everything else stays familiar.

---

## Technical fit with existing Cosmos

- Reuses the exact same player, path drawing, and step panel that already exist.
- Incidents are just another data source that the runner can load.
- Layout, themes, service passports, etc. stay completely unchanged.
- No new backend, no database, no external services.
- TypeScript remains the single source of truth.

---

## Implementation steps (high level)

1. **Add the data shape**
   - Create a simple `Incident` type that extends (or closely mirrors) the existing scenario/step types.
   - Add a new folder `src/incidents/` with one or two example recordings so people can see the format.

2. **Load the incidents**
   - Make the app discover and list all files under `src/incidents/` the same way it already discovers scenarios.

3. **UI – list + selection**
   - Add an “Incidents” section in the left panel.
   - Selecting an item loads it into the existing player.

4. **UI – playback differences**
   - Show the incident banner.
   - Optionally tint the comet or add a small badge so it’s obvious this is a historical recording.

5. **Documentation**
   - Add a short section to the README explaining how to record a new incident (the 5-step process above).
   - Include one complete example file that people can copy.

6. **Polish**
   - Make sure deep links work (`?incident=payment-cascade-2026-03-12`).
   - Keep the experience as close as possible to normal scenario playback so there is almost no learning curve.

---

## Out of scope (for this version)

- Automatic capture from production logs
- Any AI summarization or narration
- Multi-user collaborative editing of incidents
- Searching across incidents
- Diffing two incidents side-by-side
- Storing raw log files inside the repo

These can be considered later if the basic version proves useful.

---

## Effort estimate

Roughly **70–90% of one 5-hour window** (Medium size).

Most of the work is:
- Defining the data shape
- Wiring the new folder into the existing loader and player
- Adding the list + banner in the UI

Because the player and path system already exist, this is mostly “new data + small UI”, not a new playback engine.

---

## Success criteria

- A person can open Cosmos, click an incident, and watch the real path play with the real payloads.
- Creating a new incident recording takes less than 30 minutes for someone who already has the logs.
- No AI is involved at any stage.
- The feature feels like a natural extension of the existing scenario player, not a separate tool.

---

## Suggested first example

Ship one realistic example incident with the feature (based on the fictional AstroMart universe) so people immediately understand the format and can copy it when they record their first real incident.
