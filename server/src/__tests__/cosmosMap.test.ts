import { describe, expect, it } from 'vitest';
import cosmosMap from '../generated/cosmos-map.json' with { type: 'json' };

function findDuplicates(ids: string[]): string[] {
  return ids.filter((id, index) => ids.indexOf(id) !== index);
}

describe('cosmos-map snapshot', () => {
  it('has services with unique ids', () => {
    const serviceIds = cosmosMap.services.map((service) => service.id);
    expect(serviceIds.length).toBeGreaterThan(0);
    expect(findDuplicates(serviceIds)).toEqual([]);
  });

  it('has scenarios with unique ids', () => {
    const scenarioIds = cosmosMap.scenarios.map((scenario) => scenario.id);
    expect(scenarioIds.length).toBeGreaterThan(0);
    expect(findDuplicates(scenarioIds)).toEqual([]);
  });
});
