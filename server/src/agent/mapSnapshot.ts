import type { CosmosView, Protocol, Step, TeamId } from '../cosmos/types.js';
import { getCosmosView } from '../cosmos/view.js';

interface NamedEntry {
  readonly id: string;
}

export interface SnapshotStep {
  readonly from: string;
  readonly to: string;
  readonly via: string | null;
  readonly through: string | null;
  readonly type: Protocol;
  readonly parallel: boolean;
  readonly label: string;
  readonly title: string;
  readonly plain: string;
}

export interface SnapshotSubService extends NamedEntry {
  readonly name: string;
  readonly role: string;
  readonly desc: string;
  readonly repo: string | null;
}

export interface SnapshotService extends NamedEntry {
  readonly name: string;
  readonly role: string;
  readonly sub: string;
  readonly desc: string;
  readonly lang: string;
  readonly tech: readonly string[];
  readonly repo: string | null;
  readonly team: string | null;
  readonly ownerLabel: string;
  readonly domains: readonly string[];
  readonly calls: readonly string[];
  readonly publishes: readonly string[];
  readonly consumes: readonly string[];
  readonly subServices: readonly SnapshotSubService[];
}

export interface SnapshotTopic extends NamedEntry {
  readonly name: string;
  readonly desc: string;
  readonly producers: readonly string[];
  readonly consumers: readonly string[];
}

export interface SnapshotScenario extends NamedEntry {
  readonly domain: string;
  readonly title: string;
  readonly status: string;
  readonly short: string | null;
  readonly phaseId: number | null;
  readonly steps: readonly SnapshotStep[];
}

export interface SnapshotIncident extends NamedEntry {
  readonly domain: string;
  readonly title: string;
  readonly date: string;
  readonly time: string | null;
  readonly note: string;
  readonly steps: readonly SnapshotStep[];
}

/** The agent's flat projection of the cosmos view, pinned by the agent-snapshot baseline fixture. */
export interface CosmosMapSnapshot {
  readonly domains: readonly (NamedEntry & { readonly label: string; readonly short: string })[];
  readonly teams: readonly (NamedEntry & {
    readonly label: string;
    readonly githubTeam: string;
    readonly slack: string | null;
  })[];
  readonly services: readonly SnapshotService[];
  readonly topics: readonly SnapshotTopic[];
  readonly scenarios: readonly SnapshotScenario[];
  readonly incidents: readonly SnapshotIncident[];
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

export function buildMapSnapshot({ data, derived }: CosmosView): CosmosMapSnapshot {
  const stepsOf = (playableId: string) => (derived.playable.stepsById[playableId] ?? []).map(toSnapshotStep);
  return {
    domains: data.domains.map((domain) => ({ id: domain.id, label: domain.label, short: domain.short })),
    teams: (Object.keys(data.owners.teams) as TeamId[]).map((teamId) => {
      const owner = data.owners.teams[teamId];
      return { id: teamId, label: owner.label, githubTeam: owner.githubTeam, slack: owner.slack ?? null };
    }),
    services: data.services.map((service) => ({
      id: service.id,
      name: service.name,
      role: service.role,
      sub: service.sub,
      desc: service.desc,
      lang: service.lang,
      tech: [...service.tech],
      repo: service.repo ?? null,
      team: service.team ?? null,
      ownerLabel: derived.ownership.byService[service.id].label,
      ...derived.serviceLinks[service.id],
      subServices: (service.subServices ?? []).map((subService) => ({
        id: subService.id,
        name: subService.name,
        role: subService.role,
        desc: subService.desc,
        repo: subService.repo ?? null,
      })),
    })),
    topics: data.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      desc: topic.desc,
      ...derived.topicLinks[topic.id],
    })),
    scenarios: data.scenarios.map((scenario) => ({
      id: scenario.id,
      domain: scenario.domain,
      title: scenario.label,
      status: scenario.status,
      short: scenario.short ?? null,
      phaseId: scenario.phaseId ?? null,
      steps: stepsOf(scenario.id),
    })),
    incidents: data.incidents.map((incident) => ({
      id: incident.id,
      domain: incident.domain,
      title: incident.label,
      date: incident.date,
      time: incident.time ?? null,
      note: incident.note,
      steps: stepsOf(incident.id),
    })),
  };
}

const snapshotCache = new WeakMap<CosmosView, CosmosMapSnapshot>();

/** Built once per view object — i.e. once per cold start. */
export function getMapSnapshot(view: CosmosView = getCosmosView()): CosmosMapSnapshot {
  let snapshot = snapshotCache.get(view);
  if (!snapshot) {
    snapshot = buildMapSnapshot(view);
    snapshotCache.set(view, snapshot);
  }
  return snapshot;
}
