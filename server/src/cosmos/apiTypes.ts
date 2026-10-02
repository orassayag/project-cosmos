// Must stay self-contained (no imports, no runtime code): a later phase copies this file verbatim to the client.

export type Protocol = 'http' | 'ws' | 'kafka' | 'internal';

export type ScenarioStatus = 'ready' | 'soon';

export type Tech =
  | 'typescript' | 'javascript' | 'nodejs' | 'cplusplus' | 'react'
  | 'nestjs' | 'koa' | 'moleculer'
  | 'postgres' | 'aerospike' | 'redis' | 'elastic' | 'dynamodb'
  | 'kafka' | 's3' | 'webrtc' | 'gstreamer'
  | 'lua' | 'go' | 'mqtt' | 'docker' | 'githubactions';

export type TeamId = 'team-shopping' | 'team-fulfillment' | 'team-engagement';

/** A named service hue. The client renders it as `var(--svc-<key>)`; `CosmosData.palette` holds its hex. */
export type PaletteKey =
  | 'cyan' | 'green' | 'amber' | 'red' | 'violet' | 'blue' | 'pink'
  | 'magenta' | 'orange' | 'teal' | 'rose' | 'purple' | 'emerald';

export interface SubService {
  id: string;
  name: string;
  sub: string;
  role: string;
  desc: string;
  repo?: string;
  tech?: Tech[];
}

export interface EcosystemEdge {
  from: string;
  to: string;
  proto: Protocol;
}

/** A service whose sub-services can fan out on the map, and the route a 3-hop broadcast takes through them. */
export interface ServiceEcosystem {
  expandable: boolean;
  /** Topic whose records enter the ecosystem. */
  intakeTopicId: string;
  /** Sub-service that consumes the intake topic. */
  intakeSubServiceId: string;
  /** Hops between sub-services, in travel order. */
  internalEdges: EcosystemEdge[];
  /** Sub-service that delivers to the step's final destination over WebSocket. */
  egressSubServiceId: string;
}

export interface Service {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  palette: PaletteKey;
  /** Equals `CosmosData.palette[palette]`. */
  hex: string;
  name: string;
  sub: string;
  code: string;
  lang: string;
  role: string;
  desc: string;
  tech: Tech[];
  /** Omitted for non-repo services like object storage. */
  repo?: string;
  /** Omitted for external infra. */
  team?: TeamId;
  subServices?: SubService[];
  ecosystem?: ServiceEcosystem;
}

export interface Topic {
  id: string;
  x: number;
  y: number;
  labelSide?: 'above' | 'below';
  /** Keep the hand-placed x/y when the owner group fans out, instead of the computed ring slot. */
  pinned?: boolean;
  name: string;
  color: string;
  hex: string;
  desc: string;
  /** Service whose topic group (badge when zoomed out, ring when zoomed in) holds this topic. */
  groupServiceId: string;
}

export interface ClusterNebula {
  anchorServiceIds: string[];
  /** Resting hue of the zone's cloud. */
  base: PaletteKey;
  /** Hue the cloud shifts toward as activity in the zone rises. */
  hot: PaletteKey;
}

/** A labelled zone of services drawn as a backdrop behind them. */
export interface Cluster {
  id: string;
  label: string;
  serviceIds: string[];
  nebula: ClusterNebula;
}

export interface Step {
  /** Equals the owning scenario's (or incident's) `phaseId`. */
  phase: number;
  /** Service, sub-service or topic id. */
  from: string;
  to: string;
  /** Topic id of a Kafka step. */
  via?: string;
  /** Intermediate service of a 3-hop broadcast (e.g. realtime-hub). */
  through?: string;
  type: Protocol;
  label: string;
  title: string;
  plain: string;
  payload?: string;
  /** Fires in parallel with the previous step. */
  parallel?: boolean;
}

export interface Scenario {
  id: string;
  domain: string;
  /** Globally unique; set only for ready scenarios. */
  phaseId?: number;
  label: string;
  color: string;
  status: ScenarioStatus;
  short?: string;
}

export interface Domain {
  id: string;
  label: string;
  glyph: string;
  short: string;
}

export interface IncidentRef {
  label: string;
  url: string;
}

export interface Incident extends Scenario {
  incident: true;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  time?: string;
  note: string;
  refs?: IncidentRef[];
  /** Frozen recorded hops — never phase-filtered. */
  steps: Step[];
}

export interface TeamOwner {
  label: string;
  color: string;
  hex: string;
  /** GitHub team slug (without the @org/ prefix). */
  githubTeam: string;
  reviewers: string[];
  slack?: string;
}

export interface ServiceOwnerOverride {
  reviewers: string[];
}

export type DriftKind = 'added' | 'changed' | 'risk' | 'removed';

export interface DriftSource {
  repo: string;
  sha: string;
  branch?: string;
}

export interface DriftEntry {
  id: string;
  /** ISO date of the nightly run that caught this. */
  date: string;
  kind: DriftKind;
  title: string;
  detail: string;
  team?: TeamId;
  /** Service / topic ids this change touches. */
  nodeIds: string[];
  evidence?: string[];
  prNumber?: number;
  prTitle?: string;
  prOwner?: string;
  tags?: string[];
  source?: DriftSource;
  confidence?: 'high' | 'medium' | 'low';
}

export interface OnCall {
  handle: string;
  /** ISO datetime the current shift ends (UTC). */
  until: string;
  slack: string;
}

export interface ServiceHealthInput {
  serviceId: string;
  /** ISO date of the most recent commit on the service's trunk. */
  lastCommit: string;
  openPrs: number;
}

export interface Brand {
  tagline: string;
  helpTitle: string;
  /** Base URL for `Service.repo` links (no trailing slash). */
  repoBaseUrl: string;
  driftSyncUrl: string;
}

export interface CosmosOwners {
  teams: Record<TeamId, TeamOwner>;
  fallback: TeamOwner;
  serviceOverrides: Record<string, ServiceOwnerOverride>;
}

export interface CosmosDrift {
  runTimeUtc: string;
  entries: DriftEntry[];
}

export interface CosmosHealth {
  asOf: string;
  services: ServiceHealthInput[];
  onCallByTeam: Record<TeamId, OnCall>;
}

export interface CosmosData {
  brand: Brand;
  domains: Domain[];
  palette: Record<PaletteKey, string>;
  clusters: Cluster[];
  services: Service[];
  topics: Topic[];
  scenarios: Scenario[];
  steps: Step[];
  incidents: Incident[];
  owners: CosmosOwners;
  drift: CosmosDrift;
  health: CosmosHealth;
}
