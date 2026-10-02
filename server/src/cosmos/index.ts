import { BRAND } from './data/brand.js';
import { CLUSTERS } from './data/clusters.js';
import { DOMAINS } from './data/domains.js';
import { DRIFT_ENTRIES, DRIFT_RUN_TIME_UTC } from './data/drift.js';
import { HEALTH_AS_OF, ON_CALL_BY_TEAM, SERVICE_HEALTH } from './data/health.js';
import { HUB_SILENCE_2026_07_19 } from './data/incidents/hub-silence-2026-07-19.js';
import { INVENTORY_OVERSELL_2026_05_04 } from './data/incidents/inventory-oversell-2026-05-04.js';
import { PAYMENT_CASCADE_2026_03_12 } from './data/incidents/payment-cascade-2026-03-12.js';
import { FALLBACK_OWNER, SERVICE_OVERRIDES, TEAM_OWNERS } from './data/owners.js';
import { PALETTE } from './data/palette.js';
import { SCENARIOS } from './data/scenarios.js';
import { SERVICES } from './data/services.js';
import { ENGAGEMENT_STEPS } from './data/steps/engagement.js';
import { FULFILLMENT_STEPS } from './data/steps/fulfillment.js';
import { SHOPPING_STEPS } from './data/steps/shopping.js';
import { TOPICS } from './data/topics.js';
import type { CosmosData } from './types.js';

let cosmosData: CosmosData | undefined;

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}

function buildCosmosData(): CosmosData {
  return {
    brand: BRAND,
    domains: DOMAINS,
    palette: PALETTE,
    clusters: CLUSTERS,
    services: SERVICES,
    topics: TOPICS,
    scenarios: SCENARIOS,
    steps: [...SHOPPING_STEPS, ...FULFILLMENT_STEPS, ...ENGAGEMENT_STEPS],
    // Newest first — the order the UI lists incidents.
    incidents: [PAYMENT_CASCADE_2026_03_12, INVENTORY_OVERSELL_2026_05_04, HUB_SILENCE_2026_07_19].sort((first, second) =>
      second.date.localeCompare(first.date),
    ),
    owners: { teams: TEAM_OWNERS, fallback: FALLBACK_OWNER, serviceOverrides: SERVICE_OVERRIDES },
    drift: { runTimeUtc: DRIFT_RUN_TIME_UTC, entries: DRIFT_ENTRIES },
    health: { asOf: HEALTH_AS_OF, services: SERVICE_HEALTH, onCallByTeam: ON_CALL_BY_TEAM },
  };
}

export function getCosmosData(): CosmosData {
  cosmosData ??= deepFreeze(buildCosmosData());
  return cosmosData;
}
