import { describe, expect, it } from 'vitest';
import baselineFull from '../../../server/src/__tests__/fixtures/baseline-full.json';
import { BRAND } from '../scenarios/brand';
import { DOMAINS, DRIFT_ENTRIES, INCIDENTS, SCENARIOS, SERVICES, STEPS, TOPICS } from '../scenarios/data';
import { HEALTH_AS_OF, SERVICE_HEALTH } from '../scenarios/health';
import { FALLBACK_OWNER, TEAM_OWNERS } from '../scenarios/owners';

// Temporary twin of server/src/__tests__/cosmosParity.test.ts (deleted in Phase 11): keeps the client
// and server copies of the data equal by pinning both to the same baseline.
const baseline: Record<string, unknown> = baselineFull.data;

function toJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('client cosmos data parity with baseline-full.json', () => {
  const pairs: [string, unknown][] = [
    ['BRAND', BRAND],
    ['DOMAINS', DOMAINS],
    ['SERVICES', SERVICES],
    ['TOPICS', TOPICS],
    ['SCENARIOS', SCENARIOS],
    ['STEPS', STEPS],
    ['INCIDENTS', INCIDENTS],
    ['TEAM_OWNERS', TEAM_OWNERS],
    ['FALLBACK_OWNER', FALLBACK_OWNER],
    ['DRIFT_ENTRIES', DRIFT_ENTRIES],
    ['SERVICE_HEALTH', SERVICE_HEALTH],
    ['HEALTH_AS_OF', HEALTH_AS_OF],
  ];

  it.each(pairs)('%s deep-equals the baseline', (baselineKey, clientValue) => {
    expect(baseline[baselineKey]).toBeDefined();
    expect(toJson(clientValue)).toStrictEqual(baseline[baselineKey]);
  });
});
