import { describe, expect, it } from 'vitest';
import { getCosmosData } from '../cosmos/index.js';
import { CosmosDataSchema } from '../cosmos/schema.js';

describe('getCosmosData', () => {
  it('parses against the Cosmos data schema', () => {
    const result = CosmosDataSchema.safeParse(getCosmosData());
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it('returns the same deeply frozen object on every call', () => {
    const data = getCosmosData();
    expect(getCosmosData()).toBe(data);
    expect(Object.isFrozen(data)).toBe(true);
    expect(Object.isFrozen(data.services[0])).toBe(true);
    expect(Object.isFrozen(data.incidents[0].steps[0])).toBe(true);
  });

  it('rejects an unknown field', () => {
    const data = structuredClone(getCosmosData());
    Object.assign(data.services[0], { unexpectedField: true });
    expect(CosmosDataSchema.safeParse(data).success).toBe(false);
  });
});
