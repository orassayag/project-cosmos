/**
 * Drift history — the honesty loop, made visible.
 *
 * Each entry is one change the nightly Drift Sync pipeline caught: a topic
 * added, a route removed, a payload that drifted from the map. The shape
 * mirrors the pipeline's own verdict schema (see
 * `drift-sync/scripts/diff-repo.ts` — `kind`, `evidence`, `confidence`) so a
 * real run could later emit this file directly instead of the fictional
 * AstroMart data below.
 *
 * Two features read this:
 *   • F5 — the "What changed last night" map overlay (glows `nodeIds`).
 *   • F6 — the Architecture Changelog panel (lists every entry by run).
 */
import { BRAND } from './brand';
import type { Service } from './types';

/** Coarse changelog bucket. Maps 1:1 to the 🟢/🟡/🔴/📦 changelog markers. */
export type DriftKind = 'added' | 'changed' | 'risk' | 'removed';

export interface DriftEntry {
  /** Stable id — also the changelog row key. */
  id: string;
  /** ISO date (YYYY-MM-DD) of the nightly run that caught this. */
  date: string;
  kind: DriftKind;
  /** Short human title, e.g. "New topic: shipping.dispatched". */
  title: string;
  /** One-line plain-English description for the changelog row. */
  detail: string;
  /** Owning team, when the drift belongs to one. */
  team?: Service['team'];
  /**
   * Service / topic ids this change touches — must match `SERVICES[].id` or
   * `TOPICS[].id`. Drives the F5 glow and the click-to-jump target.
   */
  nodeIds: string[];
  /** file:line evidence quotes, exactly as the pipeline records them. */
  evidence?: string[];
  /** Draft PR the pipeline opened on the Cosmos repo for this run's team. */
  prNumber?: number;
  /** Title of the draft PR — falls back to `title` when absent. */
  prTitle?: string;
  /** GitHub handle of the PR author, for the changelog search facet. */
  prOwner?: string;
  /** Free-form tags (subsystem, risk area) — searchable in the changelog. */
  tags?: string[];
  /** Source repo + short SHA + branch the drift was detected on (→ commit link). */
  source?: { repo: string; sha: string; branch?: string };
  confidence?: 'high' | 'medium' | 'low';
}

/** The branch a drift entry was detected on — defaults to the repo's trunk. */
export function driftBranch(entry: DriftEntry): string {
  return entry.source?.branch ?? 'main';
}

/** The nightly Drift Sync cron fires at 04:17 UTC — every run is stamped with it. */
export const DRIFT_RUN_TIME_UTC = '04:17';

/** "Aug 13, 2026 · 04:17 UTC" — a run's date paired with the nightly cron time. */
export function driftRunDateTime(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${day} · ${DRIFT_RUN_TIME_UTC} UTC`;
}

/** The PR display name for an entry — its PR title, else the change title. */
export function driftPrName(entry: DriftEntry): string {
  return entry.prTitle ?? entry.title;
}

/**
 * Does an entry match a free-text changelog query? Case-insensitive substring
 * over every searchable facet: keywords (title/detail), tags, PR name, PR
 * owner, team, repo, commit sha and branch. Blank query matches everything.
 */
export function driftEntryMatches(entry: DriftEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    entry.title,
    entry.detail,
    entry.team,
    entry.prOwner,
    driftPrName(entry),
    entry.prNumber != null ? `pr #${entry.prNumber}` : '',
    entry.source?.repo,
    entry.source?.sha,
    driftBranch(entry),
    DRIFT_KIND_META[entry.kind].label,
    ...(entry.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

/** Base URL of the Cosmos repo, derived from the Drift Sync workflow link. */
const COSMOS_REPO_URL = BRAND.driftSyncUrl.replace(/\/actions\/.*$/, '');

/** Link to the draft PR the pipeline opened for an entry, if any. */
export function driftPrUrl(entry: DriftEntry): string | null {
  return entry.prNumber == null ? null : `${COSMOS_REPO_URL}/pull/${entry.prNumber}`;
}

/** Link to the source-repo commit the drift was detected in, if any. */
export function driftCommitUrl(entry: DriftEntry): string | null {
  return entry.source == null
    ? null
    : `${BRAND.repoBaseUrl}/${entry.source.repo}/commit/${entry.source.sha}`;
}

/** Presentation metadata per drift kind — color token, hex, and marker. */
export const DRIFT_KIND_META: Record<
  DriftKind,
  { label: string; color: string; hex: string; glyph: string }
> = {
  added:   { label: 'Added',   color: 'var(--svc-green)', hex: '#5FD08A', glyph: '🟢' },
  changed: { label: 'Changed', color: 'var(--svc-amber)', hex: '#E6C34A', glyph: '🟡' },
  risk:    { label: 'Risk',    color: 'var(--svc-red)',   hex: '#E8654A', glyph: '🔴' },
  removed: { label: 'Removed', color: 'var(--text-dim)',  hex: '#7A8088', glyph: '📦' },
};

/**
 * Fictional AstroMart drift history — newest run first. Kept fictional per
 * the project's demo-data rule; node ids are all real map nodes so the
 * overlay and jump-to-node work end to end.
 */
export const DRIFT_ENTRIES: DriftEntry[] = [
  {
    id: 'd-2026-08-13-shipping-dispatched',
    date: '2026-08-13',
    kind: 'added',
    title: 'New topic: shipping.dispatched',
    detail:
      'Shipping now publishes a dispatched event when a parcel leaves the depot; Notifications subscribes to it.',
    team: 'team-fulfillment',
    nodeIds: ['shipping', 'shipping.dispatched', 'notifications'],
    evidence: [
      'shipping/src/dispatch/publisher.ts:44 — producer.send({ topic: "shipping.dispatched" })',
      'notifications/src/handlers/dispatched.ts:12 — new consumer group "notif-dispatched"',
    ],
    prNumber: 128,
    prTitle: 'feat(shipping): emit dispatched event on depot handoff',
    prOwner: 'maya-okonkwo',
    tags: ['kafka', 'events', 'shipping'],
    source: { repo: 'shipping', sha: 'a1b2c3d', branch: 'feat/dispatched-event' },
    confidence: 'high',
  },
  {
    id: 'd-2026-08-13-orders-payload',
    date: '2026-08-13',
    kind: 'changed',
    title: 'orders.created payload gained `giftWrap`',
    detail:
      'The Orders event now carries a giftWrap flag. The map step payload was stale.',
    team: 'team-fulfillment',
    nodeIds: ['orders', 'orders.created'],
    evidence: [
      'orders/src/events/orderCreated.schema.ts:31 — giftWrap: z.boolean().default(false)',
    ],
    prNumber: 128,
    prTitle: 'feat(orders): add giftWrap flag to orders.created',
    prOwner: 'maya-okonkwo',
    tags: ['schema', 'payload', 'orders'],
    source: { repo: 'orders', sha: 'e4f5a6b', branch: 'feat/gift-wrap' },
    confidence: 'high',
  },
  {
    id: 'd-2026-08-13-catalog-search',
    date: '2026-08-13',
    kind: 'risk',
    title: 'Search reads Catalog’s Postgres directly',
    detail:
      'Search added a direct DB read against Catalog’s tables, bypassing the API — a coupling the map doesn’t model.',
    team: 'team-shopping',
    nodeIds: ['search', 'catalog'],
    evidence: [
      'search/src/index/backfill.ts:88 — new Pool({ host: "catalog-db.internal" })',
    ],
    prNumber: 129,
    prTitle: 'perf(search): backfill index straight from catalog db',
    prOwner: 'diego-ramos',
    tags: ['coupling', 'database', 'search'],
    source: { repo: 'search', sha: '7c8d9e0', branch: 'perf/direct-backfill' },
    confidence: 'medium',
  },
  {
    id: 'd-2026-08-12-payments-retry',
    date: '2026-08-12',
    kind: 'changed',
    title: 'payments.captured now retried with backoff',
    detail:
      'Payments wraps capture publishing in an exponential-backoff retry; downstream consumers may now see duplicate captures.',
    team: 'team-shopping',
    nodeIds: ['payments', 'payments.captured'],
    evidence: [
      'payments/src/capture/publisher.ts:61 — retry({ attempts: 5, backoff: "expo" })',
    ],
    prNumber: 131,
    prTitle: 'fix(payments): retry capture publish with jittered backoff',
    prOwner: 'ana-belkova',
    tags: ['reliability', 'retry', 'payments'],
    source: { repo: 'payments', sha: 'c2d3e4f', branch: 'fix/capture-retry' },
    confidence: 'high',
  },
  {
    id: 'd-2026-08-12-hub-presence',
    date: '2026-08-12',
    kind: 'added',
    title: 'Realtime hub gained a presence channel',
    detail:
      'The realtime hub now tracks live presence; the storefront subscribes for “others viewing this item”.',
    team: 'team-engagement',
    nodeIds: ['realtime-hub', 'hub-presence', 'storefront'],
    evidence: [
      'realtime-hub/src/presence/tracker.ts:20 — channel "presence:item"',
    ],
    prNumber: 133,
    prTitle: 'feat(hub): live presence channel for product pages',
    prOwner: 'sora-lindqvist',
    tags: ['realtime', 'websocket', 'presence'],
    source: { repo: 'realtime-hub', sha: 'd5e6f7a', branch: 'feat/presence' },
    confidence: 'high',
  },
  {
    id: 'd-2026-08-06-back-in-stock',
    date: '2026-08-06',
    kind: 'added',
    title: 'New topic: inventory.back-in-stock',
    detail:
      'Inventory now emits a back-in-stock event; Notifications fans out restock alerts.',
    team: 'team-fulfillment',
    nodeIds: ['inventory', 'inventory.back-in-stock', 'notifications'],
    evidence: [
      'inventory/src/restock/emitter.ts:52 — topic: "inventory.back-in-stock"',
    ],
    prNumber: 121,
    prTitle: 'feat(inventory): publish back-in-stock restock events',
    prOwner: 'maya-okonkwo',
    tags: ['kafka', 'events', 'inventory'],
    source: { repo: 'inventory', sha: '3f2a1b0', branch: 'feat/restock-events' },
    confidence: 'high',
  },
  {
    id: 'd-2026-08-06-cart-legacy-route',
    date: '2026-08-06',
    kind: 'removed',
    title: 'Removed legacy Cart → Payments route',
    detail:
      'Cart no longer calls Payments directly for quick-buy; the flow goes through Orders now. The old edge is dead.',
    team: 'team-shopping',
    nodeIds: ['cart', 'payments'],
    evidence: [
      'cart/src/quickbuy/index.ts:— deleted paymentsClient.authorize() call',
    ],
    prNumber: 122,
    prTitle: 'refactor(cart): route quick-buy through orders',
    prOwner: 'diego-ramos',
    tags: ['refactor', 'routing', 'cart'],
    source: { repo: 'cart', sha: 'b9c8d7e', branch: 'refactor/quickbuy' },
    confidence: 'high',
  },
  {
    id: 'd-2026-08-06-gateway-ratelimit',
    date: '2026-08-06',
    kind: 'risk',
    title: 'API gateway rate-limit lowered to 40 rps',
    detail:
      'The gateway’s per-tenant limit dropped from 100 to 40 rps; the storefront’s burst traffic may now be throttled.',
    team: 'team-shopping',
    nodeIds: ['api-gateway', 'storefront'],
    evidence: [
      'api-gateway/src/config/limits.ts:14 — perTenantRps: 40',
    ],
    prNumber: 124,
    prTitle: 'chore(gateway): tighten per-tenant rate limit',
    prOwner: 'ana-belkova',
    tags: ['rate-limit', 'gateway', 'capacity'],
    source: { repo: 'api-gateway', sha: 'f1a2b3c', branch: 'chore/rate-limit' },
    confidence: 'medium',
  },
  {
    id: 'd-2026-07-30-notifications-templates',
    date: '2026-07-30',
    kind: 'changed',
    title: 'Notifications switched to a new template engine',
    detail:
      'Notification rendering moved to the new MJML pipeline; the payload shape the map documented no longer matches.',
    team: 'team-engagement',
    nodeIds: ['notifications'],
    evidence: [
      'notifications/src/render/engine.ts:9 — import { renderMjml } from "./mjml"',
    ],
    prNumber: 118,
    prTitle: 'feat(notifications): render emails with MJML',
    prOwner: 'sora-lindqvist',
    tags: ['templates', 'email', 'notifications'],
    source: { repo: 'notifications', sha: 'a9b8c7d', branch: 'feat/mjml' },
    confidence: 'high',
  },
  {
    id: 'd-2026-07-30-object-storage',
    date: '2026-07-30',
    kind: 'added',
    title: 'Catalog media moved to object storage',
    detail:
      'Catalog now writes product imagery to object storage instead of the local disk cache the map still shows.',
    team: 'team-shopping',
    nodeIds: ['catalog', 'object-storage'],
    evidence: [
      'catalog/src/media/store.ts:33 — s3.putObject({ Bucket: "astromart-media" })',
    ],
    prNumber: 119,
    prTitle: 'feat(catalog): store product media in object storage',
    prOwner: 'diego-ramos',
    tags: ['storage', 'media', 'catalog'],
    source: { repo: 'catalog', sha: 'e0f1a2b', branch: 'feat/media-storage' },
    confidence: 'high',
  },
  {
    id: 'd-2026-07-30-orders-cancelled',
    date: '2026-07-30',
    kind: 'added',
    title: 'New topic: orders.cancelled',
    detail:
      'Orders now emits a cancelled event; Inventory releases the reservation and Payments voids the authorization.',
    team: 'team-fulfillment',
    nodeIds: ['orders', 'orders.cancelled', 'inventory', 'payments'],
    evidence: [
      'orders/src/cancel/publisher.ts:27 — topic: "orders.cancelled"',
    ],
    prNumber: 120,
    prTitle: 'feat(orders): emit orders.cancelled with compensation',
    prOwner: 'maya-okonkwo',
    tags: ['kafka', 'events', 'saga', 'orders'],
    source: { repo: 'orders', sha: 'b3c4d5e', branch: 'feat/cancel-event' },
    confidence: 'high',
  },
];

/** The most recent run's date, or null when there is no history. */
export const LATEST_DRIFT_DATE: string | null =
  DRIFT_ENTRIES.length > 0
    ? DRIFT_ENTRIES.reduce((max, e) => (e.date > max ? e.date : max), DRIFT_ENTRIES[0].date)
    : null;

/** Entries from the most recent run — what F5 glows as "changed last night". */
export const LATEST_DRIFT_ENTRIES: DriftEntry[] = DRIFT_ENTRIES.filter(
  (e) => e.date === LATEST_DRIFT_DATE,
);

/**
 * node id → drift kind for the latest run. When a node appears in several
 * entries, the highest-severity kind wins (risk > removed > changed > added)
 * so the overlay reflects the most important thing that happened to it.
 */
const KIND_SEVERITY: Record<DriftKind, number> = { risk: 3, removed: 2, changed: 1, added: 0 };

export const LATEST_DRIFT_BY_NODE: Map<string, DriftKind> = (() => {
  const map = new Map<string, DriftKind>();
  for (const entry of LATEST_DRIFT_ENTRIES) {
    for (const nodeId of entry.nodeIds) {
      const existing = map.get(nodeId);
      if (existing == null || KIND_SEVERITY[entry.kind] > KIND_SEVERITY[existing]) {
        map.set(nodeId, entry.kind);
      }
    }
  }
  return map;
})();

/** Drift entries grouped by run date, newest run first — for the changelog. */
export function driftEntriesByRun(): { date: string; entries: DriftEntry[] }[] {
  const byDate = new Map<string, DriftEntry[]>();
  for (const entry of DRIFT_ENTRIES) {
    const bucket = byDate.get(entry.date) ?? [];
    bucket.push(entry);
    byDate.set(entry.date, bucket);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    .map(([date, entries]) => ({ date, entries }));
}
