import type { Brand, CosmosData, DriftEntry, DriftKind, DriftLinks, LatestDrift } from '../types.js';

/** When a node appears in several latest-run entries, the most severe kind wins. */
const KIND_SEVERITY: Record<DriftKind, number> = { risk: 3, removed: 2, changed: 1, added: 0 };

export function deriveLatestDrift(entries: readonly DriftEntry[]): LatestDrift {
  const date =
    entries.length > 0 ? entries.reduce((max, entry) => (entry.date > max ? entry.date : max), entries[0].date) : null;
  const latestEntries = entries.filter((entry) => entry.date === date);
  const byNode: Record<string, DriftKind> = {};
  for (const entry of latestEntries) {
    for (const nodeId of entry.nodeIds) {
      const existing = byNode[nodeId];
      if (existing == null || KIND_SEVERITY[entry.kind] > KIND_SEVERITY[existing]) byNode[nodeId] = entry.kind;
    }
  }
  return { date, entries: latestEntries, byNode };
}

export function driftBranch(entry: DriftEntry): string {
  return entry.source?.branch ?? 'main';
}

export function driftPrName(entry: DriftEntry): string {
  return entry.prTitle ?? entry.title;
}

/**
 * Every searchable facet joined and lower-cased. The client matched the kind's display label
 * ('Added', 'Risk', …); lower-cased it equals the kind id, so the id is used here.
 */
export function driftSearchText(entry: DriftEntry): string {
  return [
    entry.title,
    entry.detail,
    entry.team,
    entry.prOwner,
    driftPrName(entry),
    entry.prNumber != null ? `pr #${entry.prNumber}` : '',
    entry.source?.repo,
    entry.source?.sha,
    driftBranch(entry),
    entry.kind,
    ...(entry.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Case-insensitive substring match against each entry's prepared search text; a blank query matches all. */
export function searchDrift(
  entries: readonly DriftEntry[],
  searchTextById: Record<string, string>,
  query: string,
): DriftEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...entries];
  return entries.filter((entry) => (searchTextById[entry.id] ?? driftSearchText(entry)).includes(normalizedQuery));
}

export function driftPrUrl(brand: Brand, entry: DriftEntry): string | null {
  const projectRepoUrl = brand.driftSyncUrl.replace(/\/actions\/.*$/, '');
  return entry.prNumber == null ? null : `${projectRepoUrl}/pull/${entry.prNumber}`;
}

export function driftCommitUrl(brand: Brand, entry: DriftEntry): string | null {
  return entry.source == null ? null : `${brand.repoBaseUrl}/${entry.source.repo}/commit/${entry.source.sha}`;
}

export function deriveDriftSearchText(data: CosmosData): Record<string, string> {
  return Object.fromEntries(data.drift.entries.map((entry) => [entry.id, driftSearchText(entry)]));
}

export function deriveDriftLinks(data: CosmosData): Record<string, DriftLinks> {
  return Object.fromEntries(
    data.drift.entries.map((entry) => [
      entry.id,
      { prUrl: driftPrUrl(data.brand, entry), commitUrl: driftCommitUrl(data.brand, entry) },
    ]),
  );
}
