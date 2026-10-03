import { BRAND } from './data/brand.js';
import { CLUSTERS } from './data/clusters.js';
import { DEMO } from './data/demo.js';
import { DOMAINS } from './data/domains.js';
import { DRIFT_ENTRIES, DRIFT_RUN_TIME_UTC, DRIFT_SOURCE } from './data/drift.js';
import { HEALTH_AS_OF, HEALTH_SOURCE, ON_CALL_BY_TEAM, SERVICE_HEALTH } from './data/health.js';
import { INCIDENTS } from './data/incidents/index.js';
import { FALLBACK_OWNER, SERVICE_OVERRIDES, TEAM_OWNERS } from './data/owners.js';
import { PALETTE } from './data/palette.js';
import { SCENARIOS } from './data/scenarios.js';
import { SERVICES } from './data/services.js';
import { STEPS } from './data/steps/index.js';
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
    steps: STEPS,
    // Newest first — the order the UI lists incidents.
    incidents: [...INCIDENTS].sort((first, second) => second.date.localeCompare(first.date)),
    owners: { teams: TEAM_OWNERS, fallback: FALLBACK_OWNER, serviceOverrides: SERVICE_OVERRIDES },
    drift: { runTimeUtc: DRIFT_RUN_TIME_UTC, entries: DRIFT_ENTRIES, source: DRIFT_SOURCE },
    health: { asOf: HEALTH_AS_OF, services: SERVICE_HEALTH, onCallByTeam: ON_CALL_BY_TEAM, source: HEALTH_SOURCE },
    demo: DEMO,
  };
}

export function getCosmosData(): CosmosData {
  cosmosData ??= deepFreeze(buildCosmosData());
  return cosmosData;
}
