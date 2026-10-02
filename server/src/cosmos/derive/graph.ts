import type { CosmosData, LogicalEdge, Protocol, ServiceLinks, Step, TopicLinks } from '../types.js';

export interface StepHop {
  from: string;
  to: string;
  type: Protocol;
}

/** A Kafka step is producer → topic → consumer; with `through`, the last leg is a WebSocket push. */
export function expandStepHops(step: Step): StepHop[] {
  if (step.via && step.through) {
    return [
      { from: step.from, to: step.via, type: 'kafka' },
      { from: step.via, to: step.through, type: 'kafka' },
      { from: step.through, to: step.to, type: 'ws' },
    ];
  }
  if (step.via) {
    return [
      { from: step.from, to: step.via, type: 'kafka' },
      { from: step.via, to: step.to, type: 'kafka' },
    ];
  }
  return [{ from: step.from, to: step.to, type: step.type }];
}

export function allSteps(data: CosmosData): Step[] {
  return [...data.steps, ...data.incidents.flatMap((incident) => incident.steps)];
}

/** Every distinct hop between two top-level nodes, from scenario and incident steps, in first-seen order. */
export function deriveLogicalEdges(data: CosmosData): LogicalEdge[] {
  const nodeIds = new Set([...data.services.map((service) => service.id), ...data.topics.map((topic) => topic.id)]);
  const edgesByKey = new Map<string, LogicalEdge>();
  for (const step of allSteps(data)) {
    for (const { from, to, type } of expandStepHops(step)) {
      const key = `${from}→${to}|${type}`;
      if (edgesByKey.has(key) || !nodeIds.has(from) || !nodeIds.has(to)) continue;
      edgesByKey.set(key, { key, type, from, to });
    }
  }
  return [...edgesByKey.values()];
}

/** Node ids referenced by at least one scenario step; topics outside it have no edges and are not drawn. */
export function deriveConnectedNodeIds(data: CosmosData): string[] {
  const ids = new Set<string>();
  for (const step of data.steps) {
    ids.add(step.from);
    ids.add(step.to);
    if (step.via) ids.add(step.via);
    if (step.through) ids.add(step.through);
  }
  return [...ids];
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function append(index: Map<string, string[]>, key: string, value: string): void {
  const existing = index.get(key);
  if (existing) existing.push(value);
  else index.set(key, [value]);
}

export function deriveLinks(data: CosmosData): {
  serviceLinks: Record<string, ServiceLinks>;
  topicLinks: Record<string, TopicLinks>;
} {
  const topicIds = new Set(data.topics.map((topic) => topic.id));
  const serviceIds = new Set(data.services.map((service) => service.id));
  const domainByPhase = new Map<number, string>();
  for (const scenario of data.scenarios) {
    if (scenario.phaseId != null) domainByPhase.set(scenario.phaseId, scenario.domain);
  }

  const callsByService = new Map<string, string[]>();
  const publishesByService = new Map<string, string[]>();
  const consumesByService = new Map<string, string[]>();
  const domainsByService = new Map<string, string[]>();

  for (const step of data.steps) {
    const domain = domainByPhase.get(step.phase);
    for (const endpoint of [step.from, step.to, step.through]) {
      if (endpoint && serviceIds.has(endpoint) && domain) append(domainsByService, endpoint, domain);
    }
    if (step.via) {
      append(publishesByService, step.from, step.via);
      append(consumesByService, step.through ?? step.to, step.via);
      continue;
    }
    if (topicIds.has(step.to)) append(publishesByService, step.from, step.to);
    if (topicIds.has(step.from)) append(consumesByService, step.to, step.from);
    const hops = step.through
      ? [[step.from, step.through], [step.through, step.to]]
      : [[step.from, step.to]];
    for (const [caller, callee] of hops) {
      if (caller !== callee && serviceIds.has(caller) && serviceIds.has(callee)) append(callsByService, caller, callee);
    }
  }

  const producersByTopic = new Map<string, string[]>();
  const consumersByTopic = new Map<string, string[]>();
  for (const [serviceId, topics] of publishesByService) {
    for (const topicId of topics) append(producersByTopic, topicId, serviceId);
  }
  for (const [serviceId, topics] of consumesByService) {
    for (const topicId of topics) append(consumersByTopic, topicId, serviceId);
  }

  return {
    serviceLinks: Object.fromEntries(
      data.services.map((service) => [
        service.id,
        {
          calls: sortedUnique(callsByService.get(service.id) ?? []),
          publishes: sortedUnique(publishesByService.get(service.id) ?? []),
          consumes: sortedUnique(consumesByService.get(service.id) ?? []),
          domains: sortedUnique(domainsByService.get(service.id) ?? []),
        },
      ]),
    ),
    topicLinks: Object.fromEntries(
      data.topics.map((topic) => [
        topic.id,
        {
          producers: sortedUnique(producersByTopic.get(topic.id) ?? []),
          consumers: sortedUnique(consumersByTopic.get(topic.id) ?? []),
        },
      ]),
    ),
  };
}
