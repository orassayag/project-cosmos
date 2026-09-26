interface NamedEntry {
  readonly id: string;
}

export interface SnapshotStep {
  readonly from: string;
  readonly to: string;
  readonly via: string | null;
  readonly through: string | null;
  readonly label: string;
}

export interface SnapshotService extends NamedEntry {
  readonly name: string;
  readonly role: string;
  readonly tech: readonly string[];
  readonly team: string | null;
  readonly ownerLabel: string;
  readonly domains: readonly string[];
  readonly calls: readonly string[];
  readonly publishes: readonly string[];
  readonly consumes: readonly string[];
}

export interface SnapshotTopic extends NamedEntry {
  readonly name: string;
  readonly producers: readonly string[];
  readonly consumers: readonly string[];
}

export interface SnapshotScenario extends NamedEntry {
  readonly title: string;
  readonly steps: readonly SnapshotStep[];
}

export interface SnapshotIncident extends NamedEntry {
  readonly title: string;
  readonly date: string;
  readonly note: string;
  readonly steps: readonly SnapshotStep[];
}

// Only the fields the agent reads; the committed cosmos-map.json satisfies this structurally.
export interface CosmosMapSnapshot {
  readonly domains: readonly (NamedEntry & { readonly label: string })[];
  readonly teams: readonly (NamedEntry & { readonly label: string })[];
  readonly services: readonly SnapshotService[];
  readonly topics: readonly SnapshotTopic[];
  readonly scenarios: readonly SnapshotScenario[];
  readonly incidents: readonly SnapshotIncident[];
}
