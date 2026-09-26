import { describe, expect, it } from 'vitest';
import cosmosMap from '../../generated/cosmos-map.json' with { type: 'json' };
import { buildMapDigest, getMapDigest } from '../context.js';
import { buildSystemPrompt, SYSTEM_PROMPT_INSTRUCTIONS } from '../systemPrompt.js';

function digestLineStartingWith(digest: string, prefix: string): string | undefined {
  return digest.split('\n').find((line) => line.startsWith(prefix));
}

describe('buildMapDigest', () => {
  const digest = buildMapDigest(cosmosMap);

  it('lists every service id from the snapshot', () => {
    const missing = cosmosMap.services.filter((service) => !digestLineStartingWith(digest, `- ${service.id}`));
    expect(missing.map((service) => service.id)).toEqual([]);
    expect(cosmosMap.services.length).toBeGreaterThan(0);
  });

  it('lists every topic, scenario, and incident id', () => {
    const ids = [...cosmosMap.topics, ...cosmosMap.scenarios, ...cosmosMap.incidents].map((entry) => entry.id);
    for (const id of ids) {
      expect(digestLineStartingWith(digest, `- ${id}`), id).toBeDefined();
    }
  });

  it('includes owner, topic producers/consumers, ordered steps, and incident date + cause', () => {
    const [service] = cosmosMap.services;
    expect(digest).toContain(`owner: ${service.ownerLabel}`);

    const [topic] = cosmosMap.topics;
    expect(digest).toContain(`producers: ${topic.producers.join(', ')} | consumers: ${topic.consumers.join(', ')}`);

    const [scenario] = cosmosMap.scenarios;
    const scenarioBlock = digest.slice(digest.indexOf(`- ${scenario.id} "${scenario.title}"`));
    const firstStep = scenario.steps[0];
    expect(scenarioBlock).toContain(`1. ${firstStep.from} → ${firstStep.to}`);
    expect(scenarioBlock).toContain(`${scenario.steps.length}. `);

    const [incident] = cosmosMap.incidents;
    expect(digest).toContain(`- ${incident.id} "${incident.title}" (${incident.date})`);
    expect(digestLineStartingWith(digest, '  cause: ')).toBeDefined();
  });

  it('caches the digest per snapshot object', () => {
    expect(getMapDigest(cosmosMap)).toBe(getMapDigest(cosmosMap));
    expect(getMapDigest(cosmosMap)).toBe(digest);
  });
});

describe('buildSystemPrompt', () => {
  it('puts the instructions first, then the digest, then the hints', () => {
    const prompt = buildSystemPrompt({
      digest: 'DIGEST',
      hints: { intent: 'playScenario', targetScenarioId: 'shopping.place-order' },
    });
    expect(prompt.startsWith(SYSTEM_PROMPT_INSTRUCTIONS)).toBe(true);
    expect(prompt.indexOf('DIGEST')).toBeGreaterThan(SYSTEM_PROMPT_INSTRUCTIONS.length);
    expect(prompt.indexOf('likely intent: playScenario')).toBeGreaterThan(prompt.indexOf('DIGEST'));
    expect(prompt).toContain('likely scenario: shopping.place-order');
  });

  it('states unknown hints plainly', () => {
    const prompt = buildSystemPrompt({ digest: 'DIGEST', hints: { intent: null, targetScenarioId: null } });
    expect(prompt).toContain('likely intent: unknown');
    expect(prompt).toContain('likely scenario: none');
  });
});
