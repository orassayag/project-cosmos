import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMapSnapshot } from '../agent/mapSnapshot.js';
import { getCosmosData } from '../cosmos/index.js';
import { getCosmosView } from '../cosmos/view.js';

// Temporary twin of client/src/__tests__/cosmosParity.test.ts: both copies must equal the baseline
// (regenerated in Phase 2; baseline-full.phase0.json keeps the original for phase2Equivalence.test.ts).
// Derived values are compared on the server only: they guard agent/UI agreement until the client reads them (Phase 8).
const baselineFull = JSON.parse(readFileSync(new URL('./fixtures/baseline-full.json', import.meta.url), 'utf8'));
const baseline = baselineFull.data;
const baselineDerived = baselineFull.derived;
const baselineCosmosMap = JSON.parse(
  readFileSync(new URL('./fixtures/baseline-cosmos-map.json', import.meta.url), 'utf8'),
);

function toJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('server cosmos data parity with baseline-full.json', () => {
  const data = getCosmosData();
  const pairs: [string, unknown][] = [
    ['BRAND', data.brand],
    ['DOMAINS', data.domains],
    ['PALETTE', data.palette],
    ['CLUSTERS', data.clusters],
    ['SERVICES', data.services],
    ['TOPICS', data.topics],
    ['SCENARIOS', data.scenarios],
    ['STEPS', data.steps],
    ['INCIDENTS', data.incidents],
    ['TEAM_OWNERS', data.owners.teams],
    ['FALLBACK_OWNER', data.owners.fallback],
    ['DRIFT_ENTRIES', data.drift.entries],
    ['SERVICE_HEALTH', data.health.services],
    ['HEALTH_AS_OF', data.health.asOf],
  ];

  it.each(pairs)('%s deep-equals the baseline', (baselineKey, serverValue) => {
    expect(baseline[baselineKey]).toBeDefined();
    expect(toJson(serverValue)).toStrictEqual(baseline[baselineKey]);
  });
});

describe('server derived values parity with baseline-full.json', () => {
  const { data, derived } = getCosmosView();
  const nodeIds = [...data.services.map((service) => service.id), ...data.topics.map((topic) => topic.id)];

  it('covers every service and topic in the baseline', () => {
    expect(Object.keys(baselineDerived.BLAST_RADIUS).sort()).toStrictEqual([...nodeIds].sort());
    expect(Object.keys(derived.blastRadius).sort()).toStrictEqual([...nodeIds].sort());
  });

  it.each(nodeIds)('blast radius of %s', (nodeId) => {
    expect(toJson(derived.blastRadius[nodeId])).toStrictEqual(baselineDerived.BLAST_RADIUS[nodeId]);
  });

  // The baseline lists 1-hop dependents in blast-radius order; the server keeps graph insertion order.
  it.each(nodeIds)('dependents of %s', (nodeId) => {
    const serverDependents = [...(derived.dependentsOf[nodeId] ?? [])].sort();
    expect(serverDependents).toStrictEqual([...baselineDerived.DEPENDENTS_OF[nodeId]].sort());
  });

  it('logical edges equal the baseline edges without path geometry', () => {
    const baselineEdges = baselineDerived.EDGES.map(({ key, type, from, to }: Record<string, string>) => ({
      key,
      type,
      from,
      to,
    }));
    expect(toJson(derived.edges)).toStrictEqual(baselineEdges);
  });

  it('connected node ids', () => {
    expect(toJson(derived.connectedNodeIds)).toStrictEqual(baselineDerived.CONNECTED_NODE_IDS);
  });

  it('topic groups equal the baseline groups without ring geometry', () => {
    const baselineGroups = baselineDerived.TOPIC_GROUPS.map(
      (group: { id: string; serviceId: string; memberIds: string[]; members: { id: string }[] }) => {
        expect(group.members.map((member) => member.id)).toStrictEqual(group.memberIds);
        return { id: group.id, serviceId: group.serviceId, memberIds: group.memberIds };
      },
    );
    expect(toJson(derived.topicGroups)).toStrictEqual(baselineGroups);
  });

  it('team groups', () => {
    expect(toJson(derived.ownership.teamGroups)).toStrictEqual(baselineDerived.TEAM_GROUPS);
  });

  it.each(Object.keys(baselineDerived.HEALTH_BY_SERVICE))('health of %s', (serviceId) => {
    expect(toJson(derived.healthStatus.byService[serviceId])).toStrictEqual(
      baselineDerived.HEALTH_BY_SERVICE[serviceId],
    );
  });

  it('health covers exactly the baseline services and counts them by status', () => {
    const baselineHealth = Object.values(baselineDerived.HEALTH_BY_SERVICE) as { status: 'fresh' | 'warm' | 'hot' }[];
    expect(Object.keys(derived.healthStatus.byService).sort()).toStrictEqual(
      Object.keys(baselineDerived.HEALTH_BY_SERVICE).sort(),
    );
    const expectedCounts = { fresh: 0, warm: 0, hot: 0 };
    for (const health of baselineHealth) expectedCounts[health.status] += 1;
    expect(toJson(derived.healthStatus.counts)).toStrictEqual(expectedCounts);
  });

  it('latest drift', () => {
    expect(derived.latestDrift.date).toBe(baseline.LATEST_DRIFT_DATE);
    expect(toJson(derived.latestDrift.entries)).toStrictEqual(baseline.LATEST_DRIFT_ENTRIES);
    expect(toJson(derived.latestDrift.byNode)).toStrictEqual(baseline.LATEST_DRIFT_BY_NODE);
  });

  it.each(Object.keys(baseline.STEPS_BY_SCENARIO))('steps of scenario %s', (scenarioId) => {
    expect(toJson(derived.playable.stepsById[scenarioId])).toStrictEqual(baseline.STEPS_BY_SCENARIO[scenarioId]);
  });

  it('playable lists every scenario, then every incident with its own steps', () => {
    expect(derived.playable.items.map((item) => item.id)).toStrictEqual([
      ...baseline.SCENARIOS.map((scenario: { id: string }) => scenario.id),
      ...baseline.INCIDENTS.map((incident: { id: string }) => incident.id),
    ]);
    for (const incident of baseline.INCIDENTS as { id: string; steps: unknown[] }[]) {
      expect(toJson(derived.playable.stepsById[incident.id])).toStrictEqual(incident.steps);
    }
  });
});

describe('server derived links parity with baseline-cosmos-map.json', () => {
  const { derived } = getCosmosView();
  const services = baselineCosmosMap.services as Record<string, unknown>[];
  const topics = baselineCosmosMap.topics as Record<string, unknown>[];

  it.each(services.map((service): [string, Record<string, unknown>] => [service.id as string, service]))(
    'service %s calls, publishes, consumes, domains and owner',
    (serviceId, { calls, publishes, consumes, domains, ownerLabel }) => {
      expect(toJson(derived.serviceLinks[serviceId])).toStrictEqual({ calls, publishes, consumes, domains });
      expect(derived.ownership.byService[serviceId].label).toBe(ownerLabel);
    },
  );

  it.each(topics.map((topic): [string, Record<string, unknown>] => [topic.id as string, topic]))(
    'topic %s producers and consumers',
    (topicId, { producers, consumers }) => {
      expect(toJson(derived.topicLinks[topicId])).toStrictEqual({ producers, consumers });
    },
  );
});

describe('agent snapshot parity with baseline-cosmos-map.json', () => {
  it('the snapshot the agent builds from the view equals the legacy cosmos-map.json', () => {
    expect(toJson(buildMapSnapshot(getCosmosView()))).toStrictEqual(baselineCosmosMap);
  });
});
