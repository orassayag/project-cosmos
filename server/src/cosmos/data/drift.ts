import type { DriftEntry } from '../types.js';

/** The nightly Drift Sync cron fires at 04:17 UTC — every run is stamped with it. */
export const DRIFT_RUN_TIME_UTC = '04:17';

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
