import { useEffect, useMemo, useRef, useState } from 'react';

import type { DriftEntry } from '../scenarios/drift';
import { DRIFT_KIND_META, driftPrUrl } from '../scenarios/drift';

interface DriftRun {
  /** ISO date of the run. */
  date: string;
  entries: DriftEntry[];
}

interface DriftOverlayProps {
  /** Every recorded run, newest first — the overlay pages through them. */
  runs: DriftRun[];
  /** Select an entry: flies the map to its node and stamps the "current time". */
  onSelect: (entry: DriftEntry) => void;
}

/** How many findings are shown before the "Load more" button appears. */
const PAGE_SIZE = 5;
/** Simulated fetch latency so the loader is actually visible on Load more. */
const LOAD_MORE_DELAY_MS = 500;

/** Human "Aug 13" from an ISO date, in UTC to match the run stamp. */
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

interface DatedEntry { date: string; entry: DriftEntry }

/** Group an already-ordered flat list back into consecutive date sections. */
function groupByRun(items: DatedEntry[]): DriftRun[] {
  const out: DriftRun[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.date === item.date) last.entries.push(item.entry);
    else out.push({ date: item.date, entries: [item.entry] });
  }
  return out;
}

/**
 * The "What changed" legend (F5). Pages through every nightly run — newest
 * first, grouped by date — a page of {@link PAGE_SIZE} findings at a time.
 * Clicking one flies the map to the affected node, and the PR link opens the
 * draft the pipeline raised. The nodes themselves glow on the map in each
 * finding's kind color while this overlay is active.
 */
export function DriftOverlay({ runs, onSelect }: DriftOverlayProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (loadTimer.current != null) window.clearTimeout(loadTimer.current);
    };
  }, []);

  // A new run list (e.g. the changelog moved the date cursor) restarts paging
  // from the first page so the top is always what's in view.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [runs]);

  const flat = useMemo<DatedEntry[]>(
    () => runs.flatMap((run) => run.entries.map((entry) => ({ date: run.date, entry }))),
    [runs],
  );
  const visibleRuns = useMemo(() => groupByRun(flat.slice(0, visibleCount)), [flat, visibleCount]);
  const hasMore = flat.length > visibleCount;

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    loadTimer.current = window.setTimeout(() => {
      setVisibleCount((count) => count + PAGE_SIZE);
      setLoadingMore(false);
      loadTimer.current = null;
    }, LOAD_MORE_DELAY_MS);
  };

  return (
    <div className="lc-drift-overlay" data-no-pan="true" onClick={(e) => e.stopPropagation()}>
      <div className="lc-drift-overlay-title">Changed</div>
      <div className="lc-drift-overlay-hint">
        {flat.length} finding{flat.length === 1 ? '' : 's'} — click to fly there
      </div>
      <div className="lc-drift-overlay-scroll">
        {visibleRuns.map((run) => (
          <section key={run.date} className="lc-drift-overlay-run">
            <div className="lc-drift-overlay-run-date">{shortDate(run.date)}</div>
            <ul className="lc-drift-overlay-list">
              {run.entries.map((entry) => {
                const meta = DRIFT_KIND_META[entry.kind];
                const prUrl = driftPrUrl(entry);
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="lc-drift-overlay-item"
                      onClick={() => onSelect(entry)}
                      title={entry.detail}
                    >
                      <span
                        className="lc-drift-overlay-swatch"
                        style={{ background: meta.color }}
                        aria-hidden="true"
                      />
                      <span className="lc-drift-overlay-label">{entry.title}</span>
                    </button>
                    {prUrl && (
                      <a
                        className="lc-drift-overlay-pr"
                        href={prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open draft PR #${entry.prNumber}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        #{entry.prNumber}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          className="lc-drift-overlay-loadmore"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <>
              <span className="lc-drift-overlay-spinner" aria-hidden="true" />
              Loading…
            </>
          ) : (
            `Load more (${flat.length - visibleCount})`
          )}
        </button>
      )}
    </div>
  );
}
