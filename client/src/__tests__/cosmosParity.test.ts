/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import baselineFull from '../../../server/src/__tests__/fixtures/baseline-full.json';
import baselinePhase0 from '../../../server/src/__tests__/fixtures/baseline-full.phase0.json';
import { BRAND } from '../scenarios/brand';
import { CLUSTERS } from '../scenarios/clusters';
import { DOMAINS, DRIFT_ENTRIES, INCIDENTS, SCENARIOS, SERVICES, STEPS, TOPICS } from '../scenarios/data';
import { HEALTH_AS_OF, SERVICE_HEALTH } from '../scenarios/health';
import { FALLBACK_OWNER, TEAM_OWNERS } from '../scenarios/owners';
import { PALETTE, paletteVar } from '../scenarios/palette';
import type { PaletteKey } from '../scenarios/types';

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
    ['PALETTE', PALETTE],
    ['CLUSTERS', CLUSTERS],
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

// Client twin of the color half of server/src/__tests__/phase2Equivalence.test.ts.
describe('client palette renders the Phase 0 service colors', () => {
  const phase0Services: { id: string; color: string; hex: string }[] = baselinePhase0.data.SERVICES;
  // Read from disk: vitest stubs CSS imports (even ?raw) to an empty string.
  const tokensCss = readFileSync(resolve(import.meta.dirname, '../styles/tokens.css'), 'utf8');

  it.each(phase0Services)('$id: paletteVar(palette) equals the Phase 0 color', (phase0Service) => {
    const service = SERVICES.find((candidate) => candidate.id === phase0Service.id);
    expect(service).toBeDefined();
    expect(paletteVar(service!.palette)).toBe(phase0Service.color);
    expect(PALETTE[service!.palette]).toBe(phase0Service.hex);
  });

  it.each(Object.keys(PALETTE) as PaletteKey[])('palette key "%s" has a --svc token in tokens.css', (key) => {
    expect(tokensCss).toMatch(new RegExp(`--svc-${key}:`));
  });
});
