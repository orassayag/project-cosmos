import type { DriftEntry } from '../api/cosmos-api';

export interface DriftRun {
  /** ISO date of the run. */
  date: string;
  entries: DriftEntry[];
}

/** "Aug 13, 2026 · 04:17 UTC" — a run's date paired with the nightly cron time. */
export function driftRunDateTime(date: string, runTimeUtc: string): string {
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${day} · ${runTimeUtc} UTC`;
}

/** Entries grouped by run date, newest run first. */
export function driftEntriesByRun(entries: readonly DriftEntry[]): DriftRun[] {
  const byDate = new Map<string, DriftEntry[]>();
  for (const entry of entries) {
    const bucket = byDate.get(entry.date) ?? [];
    bucket.push(entry);
    byDate.set(entry.date, bucket);
  }
  return [...byDate.entries()]
    .sort(([first], [second]) => (first > second ? -1 : first < second ? 1 : 0))
    .map(([date, runEntries]) => ({ date, entries: runEntries }));
}
