import { useEffect, useMemo, useRef, useState } from 'react';

import {
  DRIFT_KIND_META,
  SERVICES_BY_ID,
  TOPICS_BY_ID,
  driftBranch,
  driftCommitUrl,
  driftEntriesByRun,
  driftEntryMatches,
  driftPrUrl,
} from '../scenarios/data';
import type { DriftEntry } from '../scenarios/data';
import type { SpotlightTarget } from './Spotlight';

/** The commit context a clicked item warps the map into — shown by the title. */
export interface CosmosState {
  repo: string;
  sha: string;
  branch: string;
  title: string;
  /** ISO date of the run this change belongs to — the "current time" cursor. */
  date: string;
  /** PR author, when the change carries one. */
  owner?: string;
}

/** Payload emitted when a whole changelog item is clicked. */
export interface ChangelogActivation {
  target: SpotlightTarget;
  state: CosmosState | null;
  /** The selected entry's run date — the cursor even when `state` is null. */
  date: string;
}

interface ChangelogPanelProps {
  open: boolean;
  onClose: () => void;
  /** Fly the map to a node when a changelog item's node chip is clicked. */
  onSelectNode: (target: SpotlightTarget) => void;
  /** Warp to an item's affected node when the item itself is clicked. */
  onActivateItem: (activation: ChangelogActivation) => void;
}

/** How many items are shown before the "Load more" button appears. */
const PAGE_SIZE = 5;
/** Simulated fetch latency so the loader is actually visible on Load more. */
const LOAD_MORE_DELAY_MS = 650;

/** "Fri, Aug 13" run header from an ISO date, stamped in UTC. */
function runHeading(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** The first affected node that resolves to a live service/topic — the target
 *  a whole-item click warps toward. Null if the entry touches no known node. */
function primaryTarget(nodeIds: string[]): SpotlightTarget | null {
  for (const nodeId of nodeIds) {
    if (SERVICES_BY_ID[nodeId]) return { id: nodeId, kind: 'service' };
    if (TOPICS_BY_ID[nodeId]) return { id: nodeId, kind: 'topic' };
  }
  return null;
}

/** The commit context an entry warps into, when it has a source commit. */
export function cosmosStateFor(entry: DriftEntry): CosmosState | null {
  if (!entry.source) return null;
  return {
    repo: entry.source.repo,
    sha: entry.source.sha,
    branch: driftBranch(entry),
    title: entry.title,
    date: entry.date,
    owner: entry.prOwner,
  };
}

interface DatedEntry { date: string; entry: DriftEntry }

/** Group an already-ordered flat list back into consecutive date sections. */
function groupByRun(items: DatedEntry[]): { date: string; entries: DriftEntry[] }[] {
  const out: { date: string; entries: DriftEntry[] }[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.date === item.date) last.entries.push(item.entry);
    else out.push({ date: item.date, entries: [item.entry] });
  }
  return out;
}

/**
 * Architecture Changelog (F6). A slide-over reading the drift history as a
 * human release log: every nightly run, its 🟢 added / 🟡 changed / 🔴 risk /
 * 📦 removed findings, each linking to the draft PR, the source commit, and
 * the affected node on the map. Searchable by keyword / tag / PR / owner, and
 * paginated so long histories load a page at a time.
 */
export function ChangelogPanel({ open, onClose, onSelectNode, onActivateItem }: ChangelogPanelProps) {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset the search + pagination each time the panel opens, and cancel any
  // in-flight "load more" timer when it closes so it can't fire after unmount.
  useEffect(() => {
    if (open) {
      setQuery('');
      setVisibleCount(PAGE_SIZE);
      setLoadingMore(false);
    }
    return () => {
      if (loadTimer.current != null) window.clearTimeout(loadTimer.current);
    };
  }, [open]);

  // Flatten runs into an ordered list once (newest run first), then filter by
  // the search query. Pagination and the date-section grouping run over the
  // filtered result so a search always starts from the top.
  const flat = useMemo<DatedEntry[]>(
    () => driftEntriesByRun().flatMap((run) => run.entries.map((entry) => ({ date: run.date, entry }))),
    [],
  );
  const filtered = useMemo(() => flat.filter((item) => driftEntryMatches(item.entry, query)), [flat, query]);
  const visibleRuns = useMemo(() => groupByRun(filtered.slice(0, visibleCount)), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;

  if (!open) return null;

  const onSearch = (value: string) => {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
  };

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
    <div className="lc-changelog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="lc-changelog" role="dialog" aria-label="Architecture changelog">
        <header className="lc-changelog-head">
          <div>
            <div className="lc-changelog-eyebrow">Architecture changelog</div>
            <h2 className="lc-changelog-title">What Drift Sync caught</h2>
          </div>
          <button className="lc-changelog-close" onClick={onClose} aria-label="Close changelog">
            <svg width={14} height={14} viewBox="0 0 14 14">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="lc-changelog-search">
          <svg className="lc-changelog-search-icon" width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
            <circle cx={6} cy={6} r={4.2} fill="none" stroke="currentColor" strokeWidth={1.3} />
            <path d="M9.2 9.2 L12 12" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="lc-changelog-search-input"
            placeholder="Search keyword, tag, PR or owner…"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Search the changelog"
          />
          {query && (
            <button
              type="button"
              className="lc-changelog-search-clear"
              onClick={() => onSearch('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="lc-changelog-body">
          {filtered.length === 0 && (
            <div className="lc-changelog-empty">No changes match “{query}”.</div>
          )}
          {visibleRuns.map((run) => (
            <section key={run.date} className="lc-changelog-run">
              <div className="lc-changelog-run-date">{runHeading(run.date)}</div>
              <ul className="lc-changelog-list">
                {run.entries.map((entry) => {
                  const meta = DRIFT_KIND_META[entry.kind];
                  const prUrl = driftPrUrl(entry);
                  const commitUrl = driftCommitUrl(entry);
                  const target = primaryTarget(entry.nodeIds);
                  const activate = () => {
                    if (target) onActivateItem({ target, state: cosmosStateFor(entry), date: entry.date });
                  };
                  return (
                    <li
                      key={entry.id}
                      className={`lc-changelog-item${target ? ' lc-changelog-item--clickable' : ''}`}
                      role={target ? 'button' : undefined}
                      tabIndex={target ? 0 : undefined}
                      title={target ? 'Warp to this change on the map' : undefined}
                      onClick={target ? activate : undefined}
                      onKeyDown={
                        target
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
                            }
                          : undefined
                      }
                    >
                      <span className="lc-changelog-glyph" aria-hidden="true">{meta.glyph}</span>
                      <div className="lc-changelog-item-body">
                        <div className="lc-changelog-item-title">{entry.title}</div>
                        <div className="lc-changelog-item-detail">{entry.detail}</div>
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="lc-changelog-tags">
                            {entry.tags.map((tag) => (
                              <span key={tag} className="lc-changelog-tag">#{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="lc-changelog-item-links">
                          <span className="lc-changelog-kind" style={{ color: meta.color }}>{meta.label}</span>
                          {entry.nodeIds.map((nodeId) => {
                            const svc = SERVICES_BY_ID[nodeId];
                            const topic = TOPICS_BY_ID[nodeId];
                            const node = svc ?? topic;
                            if (!node) return null;
                            return (
                              <button
                                key={nodeId}
                                type="button"
                                className="lc-changelog-node"
                                onClick={(e) => { e.stopPropagation(); onSelectNode({ id: nodeId, kind: topic ? 'topic' : 'service' }); }}
                                title={`Show ${node.name} on the map`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                          {prUrl && (
                            <a className="lc-changelog-link" href={prUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              PR #{entry.prNumber}
                            </a>
                          )}
                          {commitUrl && entry.source && (
                            <a className="lc-changelog-link" href={commitUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              {entry.source.repo}@{entry.source.sha}
                            </a>
                          )}
                          {entry.prOwner && (
                            <span className="lc-changelog-owner" title="PR owner">@{entry.prOwner}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {hasMore && (
            <button
              type="button"
              className="lc-changelog-loadmore"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <span className="lc-changelog-spinner" aria-hidden="true" />
                  Loading…
                </>
              ) : (
                `Load more (${filtered.length - visibleCount})`
              )}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
