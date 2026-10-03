import { describe, expect, it } from 'vitest';
import { COSMOS_FIXTURE } from '../../__tests__/renderWithCosmos';
import { buildDemoScriptedAnswer } from '../scriptedAnswer';

const { aiTour } = COSMOS_FIXTURE.data.demo;

describe('buildDemoScriptedAnswer', () => {
  it('plays the tour\'s text and timing and highlights the services it names', () => {
    const answer = buildDemoScriptedAnswer(aiTour, { isPhone: false });

    expect(answer).toMatchObject(aiTour.scriptedAnswer);
    expect(answer.actions?.[0]).toEqual({ type: 'action', kind: 'highlight', serviceIds: aiTour.highlightServiceIds });
  });

  it('opens the passport beside the answer on desktop only', () => {
    const openPassport = { type: 'action', kind: 'openPassport', nodeId: aiTour.passportNodeId };

    expect(buildDemoScriptedAnswer(aiTour, { isPhone: false }).actions).toContainEqual(openPassport);
    expect(buildDemoScriptedAnswer(aiTour, { isPhone: true }).actions).toEqual([
      { type: 'action', kind: 'highlight', serviceIds: aiTour.highlightServiceIds },
    ]);
  });
});
