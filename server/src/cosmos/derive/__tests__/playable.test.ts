import { describe, expect, it } from 'vitest';
import { getCosmosData } from '../../index.js';
import { getCosmosView } from '../../view.js';
import { derivePlayable, isIncident, stepsFor } from '../playable.js';
import { makeCosmosData } from './cosmosFixture.js';

describe('derivePlayable', () => {
  const data = makeCosmosData();
  const playable = derivePlayable(data);

  it('lists scenarios, then incidents', () => {
    expect(playable.items.map((item) => item.id)).toStrictEqual(['flow.buy', 'flow.later', 'incident.outage']);
    expect(playable.items.map(isIncident)).toStrictEqual([false, false, true]);
  });

  it('plays a scenario by phase, an incident by its own steps, and nothing otherwise', () => {
    expect(stepsFor(playable, 'flow.buy')).toStrictEqual(data.steps);
    expect(stepsFor(playable, 'flow.later')).toStrictEqual([]);
    expect(stepsFor(playable, 'incident.outage')).toStrictEqual(data.incidents[0].steps);
    expect(stepsFor(playable, 'flow.unknown')).toStrictEqual([]);
  });
});

describe('getCosmosView', () => {
  it('is memoized, deeply frozen, and built on getCosmosData()', () => {
    const view = getCosmosView();
    expect(getCosmosView()).toBe(view);
    expect(view.data).toBe(getCosmosData());
    expect(Object.isFrozen(view.derived)).toBe(true);
    expect(Object.isFrozen(view.derived.blastRadius[view.data.services[0].id].dependents)).toBe(true);
    expect(Object.isFrozen(view.derived.playable.stepsById)).toBe(true);
  });
});
