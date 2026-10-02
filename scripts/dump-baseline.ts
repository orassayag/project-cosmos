import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DOMAINS,
  DRIFT_ENTRIES,
  INCIDENTS,
  LATEST_DRIFT_BY_NODE,
  LATEST_DRIFT_DATE,
  LATEST_DRIFT_ENTRIES,
  SCENARIOS,
  SERVICES,
  STEPS,
  TOPICS,
  stepsForScenario,
} from '../client/src/scenarios/data.js';
import { FALLBACK_OWNER, TEAM_OWNERS, groupServicesByTeam } from '../client/src/scenarios/owners.js';
import { HEALTH_AS_OF, HEALTH_BY_SERVICE, SERVICE_HEALTH } from '../client/src/scenarios/health.js';
import { BRAND } from '../client/src/scenarios/brand.js';
import { CLUSTERS } from '../client/src/scenarios/clusters.js';
import { PALETTE } from '../client/src/scenarios/palette.js';
import { CONNECTED_NODE_IDS, TOPIC_GROUPS } from '../client/src/map/topic-groups.js';
import { computeBlastRadius } from '../client/src/map/blast-radius.js';
import { deriveEdges } from '../client/src/map/edge-builder.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_DIR = resolve(ROOT, 'server/src/__tests__/fixtures');
const BASELINE_FULL_PATH = resolve(FIXTURES_DIR, 'baseline-full.json');
const COSMOS_MAP_SOURCE = resolve(ROOT, 'server/src/generated/cosmos-map.json');
const COSMOS_MAP_BASELINE = resolve(FIXTURES_DIR, 'baseline-cosmos-map.json');

function toPlain(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value, ([key, entry]) => [String(key), toPlain(entry)]));
  }
  if (value instanceof Set) return Array.from(value, toPlain);
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toPlain(entry)]));
  }
  return value;
}

// DEPENDENTS_OF is module-private in blast-radius.ts; its entry for a node is
// exactly the set of 1-hop dependents that computeBlastRadius reports.
function dependentsOf(nodeIds: string[]): Record<string, string[]> {
  return Object.fromEntries(
    nodeIds.map((id) => [
      id,
      computeBlastRadius(id).dependents.filter((dependent) => dependent.hops === 1).map((dependent) => dependent.id),
    ]),
  );
}

const nodeIds = [...SERVICES.map((service) => service.id), ...TOPICS.map((topic) => topic.id)];

const baseline = {
  data: {
    PALETTE,
    CLUSTERS,
    SERVICES,
    TOPICS,
    SCENARIOS,
    STEPS,
    STEPS_BY_SCENARIO: Object.fromEntries(SCENARIOS.map((scenario) => [scenario.id, stepsForScenario(scenario)])),
    INCIDENTS,
    DOMAINS,
    TEAM_OWNERS,
    FALLBACK_OWNER,
    DRIFT_ENTRIES,
    LATEST_DRIFT_DATE,
    LATEST_DRIFT_ENTRIES,
    LATEST_DRIFT_BY_NODE,
    SERVICE_HEALTH,
    HEALTH_AS_OF,
    BRAND,
  },
  derived: {
    DEPENDENTS_OF: dependentsOf(nodeIds),
    BLAST_RADIUS: Object.fromEntries(nodeIds.map((id) => [id, computeBlastRadius(id)])),
    TOPIC_GROUPS,
    CONNECTED_NODE_IDS,
    EDGES: deriveEdges(),
    TEAM_GROUPS: groupServicesByTeam(SERVICES),
    HEALTH_BY_SERVICE,
  },
};

mkdirSync(FIXTURES_DIR, { recursive: true });
writeFileSync(BASELINE_FULL_PATH, `${JSON.stringify(toPlain(baseline), null, 2)}\n`);
copyFileSync(COSMOS_MAP_SOURCE, COSMOS_MAP_BASELINE);
console.log(`dump-baseline: wrote ${BASELINE_FULL_PATH}\ndump-baseline: copied ${COSMOS_MAP_SOURCE} → ${COSMOS_MAP_BASELINE}`);
