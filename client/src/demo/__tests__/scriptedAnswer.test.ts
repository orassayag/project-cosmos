import { describe, expect, it } from 'vitest';
import { COSMOS_FIXTURE } from '../../__tests__/renderWithCosmos';
import { buildDemoScriptedTurns, scriptedAnswerDurationMs } from '../scriptedAnswer';

const { aiTour } = COSMOS_FIXTURE.data.demo;

describe('buildDemoScriptedTurns', () => {
  it('plays the tour\'s turns unchanged on desktop', () => {
    expect(buildDemoScriptedTurns(aiTour, { isPhone: false })).toEqual(aiTour.turns);
  });

  it('keeps only the highlights on a phone, so no surface covers the answer', () => {
    const phoneTurns = buildDemoScriptedTurns(aiTour, { isPhone: true });

    expect(phoneTurns.map((turn) => turn.question)).toEqual(aiTour.turns.map((turn) => turn.question));
    expect(phoneTurns.map((turn) => turn.followUps)).toEqual(aiTour.turns.map((turn) => turn.followUps));
    for (const [index, turn] of phoneTurns.entries()) {
      expect(turn.actions).toEqual(aiTour.turns[index].actions.filter((action) => action.kind === 'highlight'));
      expect(turn.actions.length).toBeGreaterThan(0);
    }
  });
});

describe('scriptedAnswerDurationMs', () => {
  it('adds one word step per word to the thinking pause', () => {
    expect(scriptedAnswerDurationMs({ text: 'three short words', thinkingMs: 1000, wordMs: 90 })).toBe(1270);
  });
});
