import type { CosmosView, DriftEntry, ResolvedHealth } from '../cosmos/types.js';
import { getMapSnapshot } from './mapSnapshot.js';
import type {
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

function formatHealth(health: ResolvedHealth): string {
  const onCall = health.onCall ? `${health.onCall.handle} until ${health.onCall.until} (${health.onCall.slack})` : NONE;
  return `  health: ${health.status}, last commit ${health.lastCommit}, ${health.openPrs} open PRs | on call: ${onCall}`;
}

function formatService(
  service: SnapshotService,
  domainLabels: ReadonlyMap<string, string>,
  health: ResolvedHealth | undefined,
): string {
  const name = service.name === service.id ? '' : ` "${service.name}"`;
  const domains = service.domains.map((domainId) => domainLabels.get(domainId) ?? domainId);
  return [
    `- ${service.id}${name}: ${toOneLine(service.role)}`,
    `  domains: ${listOrNone(domains)} | owner: ${service.ownerLabel} | tech: ${listOrNone(service.tech)}`,
    `  calls: ${listOrNone(service.calls)} | publishes: ${listOrNone(service.publishes)} | consumes: ${listOrNone(service.consumes)}`,
    ...(health ? [formatHealth(health)] : []),
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

function formatDriftEntry(entry: DriftEntry): string {
  return `- ${entry.id} [${entry.kind}] ${toOneLine(entry.title)} (${listOrNone(entry.nodeIds)})`;
}

/** Renders the whole map as compact text for the agent's system prompt. Payloads stay behind the read tools. */
export function buildMapDigest(view: CosmosView): string {
  const snapshot = getMapSnapshot(view);
  const { asOf, healthStatus, latestDrift } = view.derived;
  const domainLabels = new Map(snapshot.domains.map((domain) => [domain.id, domain.label]));
  return [
    `As of: ${asOf}`,
    '',
    `## Services (${snapshot.services.length})`,
    ...snapshot.services.map((service) =>
      formatService(service, domainLabels, healthStatus.byService[service.id]),
    ),
    '',
    `## Kafka topics (${snapshot.topics.length})`,
    ...snapshot.topics.map(formatTopic),
    '',
    `## Scenarios (${snapshot.scenarios.length}) — ordered steps`,
    ...snapshot.scenarios.map(formatScenario),
    '',
    `## Incidents (${snapshot.incidents.length})`,
    ...snapshot.incidents.map(formatIncident),
    '',
    `## Latest drift run (${latestDrift.date ?? NONE}, ${latestDrift.entries.length} changes; older runs via \`drift\`)`,
    ...latestDrift.entries.map(formatDriftEntry),
  ].join('\n');
}

const digestCache = new WeakMap<CosmosView, string>();

/** Same as `buildMapDigest`, built once per view object — i.e. once per cold start. */
export function getMapDigest(view: CosmosView): string {
  let digest = digestCache.get(view);
  if (digest === undefined) {
    digest = buildMapDigest(view);
    digestCache.set(view, digest);
  }
  return digest;
}
