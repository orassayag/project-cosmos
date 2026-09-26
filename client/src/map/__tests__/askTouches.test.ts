import { describe, expect, it } from 'vitest';

import { computeAskTouches } from '../askTouches';

const EDGES = [
  { from: 'checkout', to: 'payments-gateway' },
  { from: 'checkout', to: 'orders.created' },
  { from: 'payments-gateway', to: 'fraud-check' },
  { from: 'catalog', to: 'search' },
  { from: 'inventory', to: 'checkout' },
];

function sorted(touches: Set<string> | null): string[] | null {
  return touches ? [...touches].sort() : null;
}

describe('computeAskTouches', () => {
  it('returns null for an empty id list', () => {
    expect(computeAskTouches([], EDGES)).toBeNull();
  });

  it('includes every id plus the neighbourhood of each', () => {
    expect(sorted(computeAskTouches(['catalog', 'fraud-check'], EDGES))).toEqual(
      ['catalog', 'fraud-check', 'payments-gateway', 'search'],
    );
  });

  it('follows edges in both directions', () => {
    expect(sorted(computeAskTouches(['checkout'], EDGES))).toEqual(
      ['checkout', 'inventory', 'orders.created', 'payments-gateway'],
    );
  });

  it('dedupes overlapping neighbourhoods', () => {
    expect(sorted(computeAskTouches(['checkout', 'payments-gateway'], EDGES))).toEqual(
      ['checkout', 'fraud-check', 'inventory', 'orders.created', 'payments-gateway'],
    );
  });

  it('keeps an id with no edges as a lone touch', () => {
    expect(sorted(computeAskTouches(['unknown-service'], EDGES))).toEqual(['unknown-service']);
  });
});
