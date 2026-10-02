import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCosmosData } from '../cosmos/index.js';
import type { CosmosData, Topic } from '../cosmos/types.js';

// Phase 2 (I4) replaced two recorded values: service `color` became `palette`, and the topic-name prefix
// rule became an explicit `groupServiceId`. These tests prove both still produce the Phase 0 colors and groups.
const phase0 = JSON.parse(readFileSync(new URL('./fixtures/baseline-full.phase0.json', import.meta.url), 'utf8'));

interface Phase0Service {
  id: string;
  color: string;
  hex: string;
}

interface Phase0TopicGroup {
  id: string;
  serviceId: string;
  members: Record<string, unknown>[];
  memberIds: string[];
  cx: number;
  cy: number;
  ringRadius: number;
}

// Mirrors client/src/map/topic-groups.ts (TOPIC_GROUPS) until Phase 3 moves it to the server.
function topicGroupsFrom(data: CosmosData): Phase0TopicGroup[] {
  const connectedIds = new Set(data.steps.flatMap((step) => [step.from, step.to, step.via, step.through]));
  const membersByService = new Map<string, Topic[]>();
  for (const topic of data.topics) {
    if (!connectedIds.has(topic.id)) continue;
    const members = membersByService.get(topic.groupServiceId) ?? [];
    members.push(topic);
    membersByService.set(topic.groupServiceId, members);
  }
  return [...membersByService].map(([serviceId, members]) => {
    const service = data.services.find((candidate) => candidate.id === serviceId);
    if (!service) throw new Error(`topic group names unknown service "${serviceId}"`);
    return {
      id: `group-${serviceId}`,
      serviceId,
      members: members.map((member) => Object.fromEntries(Object.entries(member).filter(([key]) => key !== 'groupServiceId'))),
      memberIds: members.map((member) => member.id),
      cx: service.x,
      cy: service.y,
      ringRadius: Math.max(150, members.length * 15),
    };
  });
}

describe('Phase 2 equivalence with the Phase 0 baseline', () => {
  const data = getCosmosData();
  const phase0Services: Phase0Service[] = phase0.data.SERVICES;

  it('covers the same services as Phase 0', () => {
    expect(data.services.map((service) => service.id)).toEqual(phase0Services.map((service) => service.id));
  });

  it.each(phase0Services)('$id: palette renders the Phase 0 color token and hex', (phase0Service) => {
    const service = data.services.find((candidate) => candidate.id === phase0Service.id);
    expect(service).toBeDefined();
    expect(`var(--svc-${service!.palette})`).toBe(phase0Service.color);
    expect(data.palette[service!.palette]).toBe(phase0Service.hex);
    expect(service!.hex).toBe(phase0Service.hex);
  });

  it('topic groups built from groupServiceId deep-equal the Phase 0 TOPIC_GROUPS', () => {
    expect(topicGroupsFrom(data)).toStrictEqual(phase0.derived.TOPIC_GROUPS);
  });
});
