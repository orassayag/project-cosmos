import type {
  CosmosMapSnapshot,
  SnapshotIncident,
  SnapshotScenario,
  SnapshotService,
  SnapshotStep,
  SnapshotTopic,
} from './types/cosmosMapSnapshot.js';

const NONE = '-';

function listOrNone(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : NONE;
}

function toOneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function formatService(service: SnapshotService, domainLabels: ReadonlyMap<string, string>): string {
  const name = service.name === service.id ? '' : ` "${service.name}"`;
  const domains = service.domains.map((domainId) => domainLabels.get(domainId) ?? domainId);
  return [
    `- ${service.id}${name}: ${toOneLine(service.role)}`,
    `  domains: ${listOrNone(domains)} | owner: ${service.ownerLabel} | tech: ${listOrNone(service.tech)}`,
    `  calls: ${listOrNone(service.calls)} | publishes: ${listOrNone(service.publishes)} | consumes: ${listOrNone(service.consumes)}`,
  ].join('\n');
}

function formatTopic(topic: SnapshotTopic): string {
  const name = topic.name === topic.id ? '' : ` "${topic.name}"`;
  return `- ${topic.id}${name}: producers: ${listOrNone(topic.producers)} | consumers: ${listOrNone(topic.consumers)}`;
}

function formatStep(step: SnapshotStep, stepNumber: number): string {
  const through = step.through ? ` through ${step.through}` : '';
  const via = step.via ? ` via ${step.via}` : '';
  return `  ${stepNumber}. ${step.from} → ${step.to}${through}${via}: ${toOneLine(step.label)}`;
}

function formatSteps(steps: readonly SnapshotStep[]): string[] {
  return steps.map((step, index) => formatStep(step, index + 1));
}

function formatScenario(scenario: SnapshotScenario): string {
  return [`- ${scenario.id} "${scenario.title}"`, ...formatSteps(scenario.steps)].join('\n');
}

function formatIncident(incident: SnapshotIncident): string {
  return [
    `- ${incident.id} "${incident.title}" (${incident.date})`,
    `  cause: ${toOneLine(incident.note)}`,
    ...formatSteps(incident.steps),
  ].join('\n');
}

/** Renders the whole map as compact text for the agent's system prompt. */
export function buildMapDigest(snapshot: CosmosMapSnapshot): string {
  const domainLabels = new Map(snapshot.domains.map((domain) => [domain.id, domain.label]));
  return [
    `## Services (${snapshot.services.length})`,
    ...snapshot.services.map((service) => formatService(service, domainLabels)),
    '',
    `## Kafka topics (${snapshot.topics.length})`,
    ...snapshot.topics.map(formatTopic),
    '',
    `## Scenarios (${snapshot.scenarios.length}) — ordered steps`,
    ...snapshot.scenarios.map(formatScenario),
    '',
    `## Incidents (${snapshot.incidents.length})`,
    ...snapshot.incidents.map(formatIncident),
  ].join('\n');
}

const digestCache = new WeakMap<CosmosMapSnapshot, string>();

/** Same as `buildMapDigest`, built once per snapshot object — i.e. once per cold start for the committed map. */
export function getMapDigest(snapshot: CosmosMapSnapshot): string {
  let digest = digestCache.get(snapshot);
  if (digest === undefined) {
    digest = buildMapDigest(snapshot);
    digestCache.set(snapshot, digest);
  }
  return digest;
}
