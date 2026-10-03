import { describe, expect, it } from 'vitest';
import { getCosmosView } from '../../cosmos/view.js';
import { buildMapDigest, getMapDigest } from '../context.js';
import { getMapSnapshot } from '../mapSnapshot.js';
import { buildSystemPrompt, SYSTEM_PROMPT_INSTRUCTIONS } from '../systemPrompt.js';

function digestLineStartingWith(digest: string, prefix: string): string | undefined {
  return digest.split('\n').find((line) => line.startsWith(prefix));
}

const view = getCosmosView();
const cosmosMap = getMapSnapshot(view);
// Digest before Phase 6 (built from the old map snapshot file): 7,584 chars (1,942 cl100k tokens). The plan allows at most 50% growth.
const DIGEST_CHAR_BUDGET = 11_376;

describe('buildMapDigest', () => {
  const digest = buildMapDigest(view);

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

  it('starts with the as-of date and adds one health/on-call line per service with health data', () => {
    expect(digest.startsWith(`As of: ${view.derived.asOf}\n`)).toBe(true);
    const healthLines = digest.split('\n').filter((line) => line.startsWith('  health: '));
    expect(healthLines).toHaveLength(Object.keys(view.derived.healthStatus.byService).length);
    const { onCall } = view.derived.healthStatus.byService.payments;
    expect(digest).toContain(`on call: ${onCall?.handle} until ${onCall?.until}`);
  });

  it('summarizes the latest drift run, one line per entry', () => {
    const { date, entries } = view.derived.latestDrift;
    expect(digest).toContain(`## Latest drift run (${date}, ${entries.length} changes`);
    for (const entry of entries) {
      expect(digestLineStartingWith(digest, `- ${entry.id} [${entry.kind}]`), entry.id).toBeDefined();
    }
  });

  it('stays within the token budget and leaves payloads to the read tools', () => {
    expect(digest.length).toBeLessThanOrEqual(DIGEST_CHAR_BUDGET);
    const payloads = view.data.steps.flatMap((step) => (step.payload ? [step.payload] : []));
    expect(payloads.length).toBeGreaterThan(0);
    expect(payloads.filter((payload) => digest.includes(payload))).toEqual([]);
  });

  it('caches the digest per view object', () => {
    expect(getMapDigest(view)).toBe(getMapDigest(view));
    expect(getMapDigest(view)).toBe(digest);
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
