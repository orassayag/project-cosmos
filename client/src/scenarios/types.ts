export type Protocol = 'http' | 'ws' | 'kafka' | 'internal';

export type ScenarioStatus = 'ready' | 'soon';

/** Known tech tags rendered as icons in the Service detail panel. */
export type Tech =
  | 'typescript' | 'javascript' | 'nodejs' | 'cplusplus' | 'react'
  | 'nestjs' | 'koa' | 'moleculer'
  | 'postgres' | 'aerospike' | 'redis' | 'elastic' | 'dynamodb'
  | 'kafka' | 's3' | 'webrtc' | 'gstreamer'
  | 'lua' | 'go' | 'mqtt' | 'docker' | 'githubactions';

/** A named service hue, rendered as `var(--svc-<key>)` (styles/tokens.css); `PALETTE` holds its hex. */
export type PaletteKey =
  | 'cyan' | 'green' | 'amber' | 'red' | 'violet' | 'blue' | 'pink'
  | 'magenta' | 'orange' | 'teal' | 'rose' | 'purple' | 'emerald';

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
  /** Concrete hex of the same hue (`PALETTE[palette]`) — for SVG defs that can't take CSS vars (gradients). */
  hex: string;
  name: string;
  /** Short stack/tech line shown under the name. */
  sub: string;
  /** Display code shown in the side panel header (e.g. "BRW-01"). */
  code: string;
  /** Primary implementation language. */
  lang: string;
  /** One-line role label (panel subtitle). */
  role: string;
  /** Long description used in the side panel. */
  desc: string;
  /** Structured tech-stack tags — icons rendered in the side panel. */
  tech: Tech[];
  /** GitHub repo name (under the org). Omit for non-repo services like object storage. */
  repo?: string;
  /** Owning team. Omit for external infra (object storage, etc.). */
  team?: 'team-shopping' | 'team-fulfillment' | 'team-engagement';
  /** Sub-services that make up this service's ecosystem. */
  subServices?: SubService[];
  /** When `expandable`, the sub-services fan out as a small solar system around the parent. */
  ecosystem?: ServiceEcosystem;
}

export interface SubService {
  id: string;
  name: string;
  /** Short stack/role line shown under the name on the sub-capsule. */
  sub: string;
  /** One-line role for the inspector header. */
  role: string;
  /** Long description shown when the sub-capsule is clicked. */
  desc: string;
  /** GitHub repo name under the org. */
  repo?: string;
  /** Tech chips for the inspector. */
  tech?: Tech[];
}

export interface Topic {
  id: string;
  x: number;
  y: number;
  /** When set, forces the label above or below the node. */
  labelSide?: 'above' | 'below';
  /**
   * When the owner group fans out, place this topic at its hand-placed
   * x/y instead of the computed ring slot. It still collapses into the
   * owner's badge when zoomed out. Use when the auto ring collides with
   * neighbors.
   */
  pinned?: boolean;
  /** Topic's wire name (mono caps). */
  name: string;
  /** CSS variable reference for the topic's color (defaults to --svc-orange). */
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
  /** Global phase id. Matches `Scenario.phaseId`. */
  phase: number;
  /** Service id OR topic id. */
  from: string;
  to: string;
  /** Topic id when this is a Kafka step (renders producer → topic → consumer). */
  via?: string;
  /** Intermediate service id when this is a 3-hop broadcast (e.g. realtime-hub). */
  through?: string;
  type: Protocol;
  /** Short label rendered on the timeline. */
  label: string;
  /** Step title in the side panel. */
  title: string;
  /** Long narrative for the side panel. */
  plain: string;
  /** Optional payload sample (HTTP/WS/Kafka body). */
  payload?: string;
  /** When true, this step fires in parallel with the previous one. */
  parallel?: boolean;
}

export interface Scenario {
  id: string;
  domain: string;
  /** Global phase id (matches Step.phase). Set ONLY for ready scenarios. */
  phaseId?: number;
  label: string;
  /** CSS variable color for chips/highlights. */
  color: string;
  status: ScenarioStatus;
  /** One-line summary used in chips and "Coming soon" placeholders. */
  short?: string;
}

export interface Domain {
  id: string;
  label: string;
  /** Display icon (single character — kept minimal, no emoji in the cosmos UI). */
  glyph: string;
  short: string;
}
