import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCosmosData } from '../cosmos/index.js';

// Temporary twin of client/src/__tests__/cosmosParity.test.ts: both copies must equal the baseline
// (regenerated in Phase 2; baseline-full.phase0.json keeps the original for phase2Equivalence.test.ts).
// Only raw-data keys are compared; derived values (LATEST_DRIFT_*, STEPS_BY_SCENARIO) are Phase 3 parity.
const baseline = JSON.parse(readFileSync(new URL('./fixtures/baseline-full.json', import.meta.url), 'utf8')).data;

function toJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('server cosmos data parity with baseline-full.json', () => {
  const data = getCosmosData();
  const pairs: [string, unknown][] = [
    ['BRAND', data.brand],
    ['DOMAINS', data.domains],
    ['PALETTE', data.palette],
    ['CLUSTERS', data.clusters],
    ['SERVICES', data.services],
    ['TOPICS', data.topics],
    ['SCENARIOS', data.scenarios],
    ['STEPS', data.steps],
    ['INCIDENTS', data.incidents],
    ['TEAM_OWNERS', data.owners.teams],
    ['FALLBACK_OWNER', data.owners.fallback],
    ['DRIFT_ENTRIES', data.drift.entries],
    ['SERVICE_HEALTH', data.health.services],
    ['HEALTH_AS_OF', data.health.asOf],
  ];

  it.each(pairs)('%s deep-equals the baseline', (baselineKey, serverValue) => {
    expect(baseline[baselineKey]).toBeDefined();
    expect(toJson(serverValue)).toStrictEqual(baseline[baselineKey]);
  });
});
