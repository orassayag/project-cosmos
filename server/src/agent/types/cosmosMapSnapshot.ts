import type { Protocol } from '../../cosmos/types.js';

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

/** The agent's flat projection of the cosmos view; same shape and content as the legacy `cosmos-map.json`. */
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
