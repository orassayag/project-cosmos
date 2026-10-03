import { describe, expect, it } from 'vitest';
import { COSMOS_FIXTURE } from '../../__tests__/renderWithCosmos';
import { MAX_FOLLOW_UPS, suggestFollowUps } from '../followUps';

const { data } = COSMOS_FIXTURE;
const [firstService, secondService] = data.services;
const readyScenario = data.scenarios.find((scenario) => scenario.status === 'ready')!;

describe('suggestFollowUps', () => {
  it('builds owner, failure and play chips from the answer’s map actions, capped at three', () => {
    const followUps = suggestFollowUps(
      {
        content: 'Here is the flow.',
        actions: [
          { type: 'action', kind: 'highlight', serviceIds: [firstService.id, secondService.id] },
          { type: 'action', kind: 'playScenario', scenarioId: readyScenario.id },
        ],
      },
      data,
    );

    expect(followUps).toEqual([
      `Who owns ${firstService.name}?`,
      `What breaks if ${firstService.name} fails?`,
      `Play ${readyScenario.label}`,
    ]);
    expect(followUps.length).toBeLessThanOrEqual(MAX_FOLLOW_UPS);
  });

  it('uses ids the answer text mentions when it ran no actions', () => {
    const followUps = suggestFollowUps({ content: `Requests pass through ${secondService.id} first.`, actions: [] }, data);

    expect(followUps).toEqual([`Who owns ${secondService.name}?`, `What breaks if ${secondService.name} fails?`]);
  });

  it('only offers ids that exist in the snapshot', () => {
    const followUps = suggestFollowUps(
      {
        content: 'Nothing real here.',
        actions: [
          { type: 'action', kind: 'openPassport', nodeId: 'no-such-service' },
          { type: 'action', kind: 'playScenario', scenarioId: 'no.such-scenario' },
        ],
      },
      data,
    );

    expect(followUps).toEqual([]);
  });

  it('offers nothing when the answer mentioned nothing on the map', () => {
    expect(suggestFollowUps({ content: 'I can only help with the map.', actions: [] }, data)).toEqual([]);
  });
});
