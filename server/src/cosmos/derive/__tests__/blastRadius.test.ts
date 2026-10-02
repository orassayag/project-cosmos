import { describe, expect, it } from 'vitest';
import { computeBlastRadius, dependentsOf, deriveBlastRadius, deriveDependentsOf } from '../blastRadius.js';
import { makeCosmosData, makeStep } from './cosmosFixture.js';

describe('deriveDependentsOf', () => {
  const dependentsByNode = deriveDependentsOf(makeCosmosData());

  it('points a synchronous call backwards: the caller breaks when the callee changes', () => {
    expect(dependentsOf(dependentsByNode, 'checkout')).toContain('gateway');
    expect(dependentsOf(dependentsByNode, 'bucket')).toStrictEqual(['mailer']);
  });

  it('points a kafka hand-off forwards: the consumer breaks when the producer changes', () => {
    expect(dependentsOf(dependentsByNode, 'checkout')).toContain('order.placed');
    expect(dependentsOf(dependentsByNode, 'order.placed')).toStrictEqual(['mailer']);
  });

  it('ignores incident steps and returns nothing for a node with no dependents', () => {
    expect(dependentsOf(dependentsByNode, 'gateway')).toStrictEqual([]);
  });
});

describe('computeBlastRadius', () => {
  const data = makeCosmosData();
  const dependentsByNode = deriveDependentsOf(data);

  it('ranks dependents by hop count, then name', () => {
    expect(computeBlastRadius(data, dependentsByNode, 'checkout')).toStrictEqual({
      sourceId: 'checkout',
      levels: { checkout: 'source', gateway: 'high', 'order.placed': 'high', mailer: 'med' },
      dependents: [
        { id: 'gateway', name: 'Gateway', level: 'high', hops: 1 },
        { id: 'order.placed', name: 'order.placed', level: 'high', hops: 1 },
        { id: 'mailer', name: 'Mailer', level: 'med', hops: 2 },
      ],
    });
  });

  it('marks three or more hops low and falls back to the id for an unnamed node', () => {
    const extended = makeCosmosData();
    extended.steps.push(makeStep(1, 'auditor', 'mailer'));
    const result = computeBlastRadius(extended, deriveDependentsOf(extended), 'checkout');
    expect(result.levels.auditor).toBe('low');
    expect(result.dependents.at(-1)).toStrictEqual({ id: 'auditor', name: 'auditor', level: 'low', hops: 3 });
  });
});

describe('deriveBlastRadius', () => {
  it('has one entry per service and topic', () => {
    const data = makeCosmosData();
    expect(Object.keys(deriveBlastRadius(data, deriveDependentsOf(data)))).toStrictEqual([
      'gateway',
      'checkout',
      'mailer',
      'bucket',
      'order.placed',
      'order.orphan',
    ]);
  });
});
