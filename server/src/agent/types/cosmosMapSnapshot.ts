interface NamedEntry {
  readonly id: string;
}

// Only the fields the agent reads; the committed cosmos-map.json satisfies this structurally.
export interface CosmosMapSnapshot {
  readonly domains: readonly (NamedEntry & { readonly label: string })[];
  readonly teams: readonly (NamedEntry & { readonly label: string })[];
  readonly services: readonly (NamedEntry & { readonly name: string })[];
  readonly topics: readonly (NamedEntry & { readonly name: string })[];
  readonly scenarios: readonly (NamedEntry & { readonly title: string })[];
  readonly incidents: readonly (NamedEntry & { readonly title: string })[];
}
