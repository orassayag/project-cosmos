import { describe, expect, it } from 'vitest';
import { indexCosmos } from '../../api/cosmosIndex';
import { COSMOS_FIXTURE } from '../../__tests__/renderWithCosmos';
import { DEMO_SCRIPTED_ANSWER } from '../scriptedAnswer';

const SERVICES_BY_ID = indexCosmos(COSMOS_FIXTURE).servicesById;

const highlightedIds = (DEMO_SCRIPTED_ANSWER.actions ?? []).flatMap((action) =>
  action.kind === 'highlight' ? action.serviceIds : [],
);

describe('DEMO_SCRIPTED_ANSWER', () => {
  it('highlights only services that exist on the map', () => {
    expect(highlightedIds.length).toBeGreaterThan(0);
    for (const serviceId of highlightedIds) expect(SERVICES_BY_ID[serviceId], serviceId).toBeDefined();
  });

  it('names every service it highlights', () => {
    for (const serviceId of highlightedIds) expect(DEMO_SCRIPTED_ANSWER.text).toContain(serviceId);
  });

  it('uses the planned timing', () => {
    expect(DEMO_SCRIPTED_ANSWER.thinkingMs).toBe(1500);
    expect(DEMO_SCRIPTED_ANSWER.wordMs).toBe(90);
  });
});
