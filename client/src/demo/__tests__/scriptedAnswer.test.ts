import { describe, expect, it } from 'vitest';
import { SERVICES_BY_ID } from '../../scenarios/data';
import { DEMO_SCRIPTED_ANSWER } from '../scriptedAnswer';
import { AI_DEMO_SCRIPT } from '../scripts';

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

  it('uses the planned timing and finishes inside the answer step', () => {
    expect(DEMO_SCRIPTED_ANSWER.thinkingMs).toBe(1500);
    expect(DEMO_SCRIPTED_ANSWER.wordMs).toBe(90);
    const wordCount = DEMO_SCRIPTED_ANSWER.text.split(' ').length;
    const playMs = DEMO_SCRIPTED_ANSWER.thinkingMs + wordCount * DEMO_SCRIPTED_ANSWER.wordMs;
    const answerStep = AI_DEMO_SCRIPT.find((step) => step.kind === 'answer');
    expect(answerStep).toBeDefined();
    expect(playMs).toBeLessThanOrEqual(answerStep!.durationMs);
  });
});
