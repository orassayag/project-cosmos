/**
 * Service health & on-call rotation — the data behind F17's heat map.
 *
 * Every service that owns a repo gets a health snapshot: how recently it was
 * touched (`lastCommit`), how much work is in flight (`openPrs`), and who is
 * carrying the pager for its team right now. The heat-map overlay tints each
 * star by the derived {@link HealthStatus}; clicking one surfaces the on-call
 * card.
 *
 * Like `drift.ts`, this is fictional AstroMart data whose ids are all real map
 * nodes, and its shape is deliberately flat so a nightly Drift Sync run could
 * later regenerate it in place — the on-call rotation especially is "just
 * another data file the pipeline keeps fresh", no backend required.
 */
import type { Service } from './types';
import { resolveOwner } from './owners';
import { SERVICES } from './services';

type TeamId = NonNullable<Service['team']>;

/** Coarse heat bucket, coldest → hottest. */
export type HealthStatus = 'fresh' | 'warm' | 'hot';

export interface OnCall {
  /** GitHub handle of whoever is holding the pager. */
  handle: string;
  /** ISO datetime the current shift ends (UTC). */
  until: string;
  /** Slack channel to escalate in. */
  slack: string;
}

/** Raw per-service metrics — the only thing a real pipeline would rewrite. */
export interface ServiceHealthInput {
  serviceId: string;
  /** ISO date (YYYY-MM-DD) of the most recent commit on the service's trunk. */
  lastCommit: string;
  /** Count of open pull requests against the service's repo. */
  openPrs: number;
}

/** The date the snapshot below was captured — the anchor commit-age is measured from. */
export const HEALTH_AS_OF = '2026-08-14';

/**
 * On-call rotation, keyed by team. This is the "rotation file" F17 treats as
 * fresh data — swap it for a PagerDuty/Opsgenie export and nothing else changes.
 */
export const ON_CALL_BY_TEAM: Record<TeamId, OnCall> = {
  'team-shopping': { handle: 'ana-belkova', until: '2026-08-14T18:00:00Z', slack: '#team-shopping' },
  'team-fulfillment': { handle: 'maya-okonkwo', until: '2026-08-14T21:00:00Z', slack: '#team-fulfillment' },
  'team-engagement': { handle: 'sora-lindqvist', until: '2026-08-14T15:30:00Z', slack: '#team-engagement' },
};

/** Fictional health metrics — one row per repo-backed service. */
export const SERVICE_HEALTH: ServiceHealthInput[] = [
  { serviceId: 'storefront',    lastCommit: '2026-08-14', openPrs: 2 },
  { serviceId: 'api-gateway',   lastCommit: '2026-08-13', openPrs: 4 },
  { serviceId: 'cart',          lastCommit: '2026-08-02', openPrs: 1 },
  { serviceId: 'search',        lastCommit: '2026-07-15', openPrs: 1 },
  { serviceId: 'catalog',       lastCommit: '2026-08-11', openPrs: 7 },
  { serviceId: 'orders',        lastCommit: '2026-08-14', openPrs: 5 },
  { serviceId: 'payments',      lastCommit: '2026-08-10', openPrs: 3 },
  { serviceId: 'inventory',     lastCommit: '2026-08-12', openPrs: 0 },
  { serviceId: 'shipping',      lastCommit: '2026-08-13', openPrs: 1 },
  { serviceId: 'notifications', lastCommit: '2026-07-25', openPrs: 2 },
  { serviceId: 'realtime-hub',  lastCommit: '2026-08-09', openPrs: 1 },
];

/** Presentation metadata per status — color token, hex, marker, one-liner. */
export const HEALTH_STATUS_META: Record<
  HealthStatus,
  { label: string; color: string; hex: string; glyph: string; blurb: string }
> = {
  fresh: { label: 'Fresh', color: 'var(--svc-green)', hex: '#5FD08A', glyph: '🟢', blurb: 'touched recently, light load' },
  warm:  { label: 'Warm',  color: 'var(--svc-amber)', hex: '#E6C34A', glyph: '🟡', blurb: 'a bit stale or a busy queue' },
  hot:   { label: 'Hot',   color: 'var(--svc-red)',   hex: '#E8654A', glyph: '🔴', blurb: 'stale or a deep PR backlog' },
};

/** Whole days between an ISO date and the snapshot anchor (floored, never negative). */
export function daysSinceCommit(lastCommit: string, asOf: string = HEALTH_AS_OF): number {
  const then = Date.parse(`${lastCommit}T00:00:00Z`);
  const now = Date.parse(`${asOf}T00:00:00Z`);
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}

/**
 * Derive the heat bucket from the raw metrics. Staleness and PR backlog are
 * independent triggers — the worse of the two wins, so a repo committed to
 * hourly but drowning in review is still flagged hot.
 */
export function statusFor(input: ServiceHealthInput, asOf: string = HEALTH_AS_OF): HealthStatus {
  const age = daysSinceCommit(input.lastCommit, asOf);
  if (age > 21 || input.openPrs >= 6) return 'hot';
  if (age > 7 || input.openPrs >= 3) return 'warm';
  return 'fresh';
}

export interface ResolvedHealth extends ServiceHealthInput {
  status: HealthStatus;
  ageDays: number;
  onCall: OnCall | null;
  team: TeamId | null;
  /** Owning team's display label (or the unowned fallback). */
  teamLabel: string;
}

/** Merge a service's raw metrics with its derived status and team on-call. */
export function resolveHealth(input: ServiceHealthInput): ResolvedHealth {
  const service = SERVICES.find((s) => s.id === input.serviceId);
  const team = service?.team ?? null;
  const owner = service ? resolveOwner(service) : null;
  return {
    ...input,
    status: statusFor(input),
    ageDays: daysSinceCommit(input.lastCommit),
    onCall: team ? ON_CALL_BY_TEAM[team] : null,
    team,
    teamLabel: owner?.label ?? 'Platform · unowned',
  };
}

/** service id → resolved health, for O(1) lookup on the map. */
export const HEALTH_BY_SERVICE: Map<string, ResolvedHealth> = new Map(
  SERVICE_HEALTH.map((input) => [input.serviceId, resolveHealth(input)]),
);

/** How many services sit in each bucket — drives the legend counts. */
export const HEALTH_STATUS_COUNTS: Record<HealthStatus, number> = (() => {
  const counts: Record<HealthStatus, number> = { fresh: 0, warm: 0, hot: 0 };
  for (const health of HEALTH_BY_SERVICE.values()) counts[health.status] += 1;
  return counts;
})();
