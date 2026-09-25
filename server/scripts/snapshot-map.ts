import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  DOMAINS,
  INCIDENTS,
  SCENARIOS,
  SERVICES,
  STEPS,
  TOPICS,
  stepsForScenario,
} from '../../client/src/scenarios/data.js';
import { TEAM_OWNERS, resolveOwner } from '../../client/src/scenarios/owners.js';
import type { Step } from '../../client/src/scenarios/types.js';

export const COSMOS_MAP_PATH = fileURLToPath(
  new URL('../src/generated/cosmos-map.json', import.meta.url),
);

export interface SnapshotStep {
  from: string;
  to: string;
  via: string | null;
  through: string | null;
  type: Step['type'];
  parallel: boolean;
  label: string;
  title: string;
  plain: string;
}

export interface SnapshotService {
  id: string;
  name: string;
  role: string;
  sub: string;
  desc: string;
  lang: string;
  tech: string[];
  repo: string | null;
  team: string | null;
  ownerLabel: string;
  domains: string[];
  calls: string[];
  publishes: string[];
  consumes: string[];
  subServices: { id: string; name: string; role: string; desc: string; repo: string | null }[];
}

export interface SnapshotTopic {
  id: string;
  name: string;
  desc: string;
  producers: string[];
  consumers: string[];
}

export interface SnapshotScenario {
  id: string;
  domain: string;
  title: string;
  status: string;
  short: string | null;
  phaseId: number | null;
  steps: SnapshotStep[];
}

export interface SnapshotIncident {
  id: string;
  domain: string;
  title: string;
  date: string;
  time: string | null;
  note: string;
  steps: SnapshotStep[];
}

export interface CosmosMap {
  domains: { id: string; label: string; short: string }[];
  teams: { id: string; label: string; githubTeam: string; slack: string | null }[];
  services: SnapshotService[];
  topics: SnapshotTopic[];
  scenarios: SnapshotScenario[];
  incidents: SnapshotIncident[];
}

function toSnapshotStep(step: Step): SnapshotStep {
  return {
    from: step.from,
    to: step.to,
    via: step.via ?? null,
    through: step.through ?? null,
    type: step.type,
    parallel: step.parallel ?? false,
    label: step.label,
    title: step.title,
    plain: step.plain,
  };
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

export function buildCosmosMap(): CosmosMap {
  const topicIds = new Set(TOPICS.map((topic) => topic.id));
  const serviceIds = new Set(SERVICES.map((service) => service.id));
  const domainByPhase = new Map<number, string>();
  for (const scenario of SCENARIOS) {
    if (scenario.phaseId != null) domainByPhase.set(scenario.phaseId, scenario.domain);
  }

  const callsByService = new Map<string, string[]>();
  const publishesByService = new Map<string, string[]>();
  const consumesByService = new Map<string, string[]>();
  const domainsByService = new Map<string, string[]>();
  const append = (index: Map<string, string[]>, key: string, value: string) => {
    const existing = index.get(key);
    if (existing) existing.push(value);
    else index.set(key, [value]);
  };

  // A kafka step is producer → topic (via) → consumer, where the consumer is
  // the through-service when set (the final `to` then receives it over a socket).
  for (const step of STEPS) {
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
    const hops = step.through ? [[step.from, step.through], [step.through, step.to]] : [[step.from, step.to]];
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
    domains: DOMAINS.map((domain) => ({ id: domain.id, label: domain.label, short: domain.short })),
    teams: Object.entries(TEAM_OWNERS).map(([teamId, owner]) => ({
      id: teamId,
      label: owner.label,
      githubTeam: owner.githubTeam,
      slack: owner.slack ?? null,
    })),
    services: SERVICES.map((service) => ({
      id: service.id,
      name: service.name,
      role: service.role,
      sub: service.sub,
      desc: service.desc,
      lang: service.lang,
      tech: [...service.tech],
      repo: service.repo ?? null,
      team: service.team ?? null,
      ownerLabel: resolveOwner(service).label,
      domains: sortedUnique(domainsByService.get(service.id) ?? []),
      calls: sortedUnique(callsByService.get(service.id) ?? []),
      publishes: sortedUnique(publishesByService.get(service.id) ?? []),
      consumes: sortedUnique(consumesByService.get(service.id) ?? []),
      subServices: (service.subServices ?? []).map((subService) => ({
        id: subService.id,
        name: subService.name,
        role: subService.role,
        desc: subService.desc,
        repo: subService.repo ?? null,
      })),
    })),
    topics: TOPICS.map((topic) => ({
      id: topic.id,
      name: topic.name,
      desc: topic.desc,
      producers: sortedUnique(producersByTopic.get(topic.id) ?? []),
      consumers: sortedUnique(consumersByTopic.get(topic.id) ?? []),
    })),
    scenarios: SCENARIOS.map((scenario) => ({
      id: scenario.id,
      domain: scenario.domain,
      title: scenario.label,
      status: scenario.status,
      short: scenario.short ?? null,
      phaseId: scenario.phaseId ?? null,
      steps: stepsForScenario(scenario).map(toSnapshotStep),
    })),
    incidents: INCIDENTS.map((incident) => ({
      id: incident.id,
      domain: incident.domain,
      title: incident.label,
      date: incident.date,
      time: incident.time ?? null,
      note: incident.note,
      steps: incident.steps.map(toSnapshotStep),
    })),
  };
}

export function serializeCosmosMap(cosmosMap: CosmosMap = buildCosmosMap()): string {
  return `${JSON.stringify(cosmosMap)}\n`;
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  writeFileSync(COSMOS_MAP_PATH, serializeCosmosMap());
  console.log(`✓ wrote ${COSMOS_MAP_PATH}`);
}
