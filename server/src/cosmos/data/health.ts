import type { DataSource, OnCall, ServiceHealthInput, TeamId } from '../types.js';

/** Hand-written AstroMart demo metrics; no external health source feeds this yet. */
export const HEALTH_SOURCE: DataSource = 'fixture';

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
