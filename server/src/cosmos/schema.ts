import { z } from 'zod';
import type {
  BlastNode,
  BlastResult,
  Brand,
  Cluster,
  CosmosData,
  CosmosDemo,
  CosmosDerived,
  CosmosDrift,
  CosmosHealth,
  CosmosHealthStatus,
  CosmosOwners,
  CosmosOwnership,
  CosmosPlayable,
  CosmosResponse,
  Domain,
  DriftEntry,
  DriftLinks,
  Incident,
  IncidentRef,
  LatestDrift,
  LogicalEdge,
  OnCall,
  PaletteKey,
  Protocol,
  ResolvedHealth,
  ResolvedOwner,
  Scenario,
  Service,
  ServiceEcosystem,
  ServiceHealthInput,
  ServiceLinks,
  Step,
  SubService,
  Tech,
  TeamGroup,
  TeamId,
  TeamOwner,
  Topic,
  TopicGroup,
  TopicLinks,
} from './types.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const ProtocolSchema = z.enum(['http', 'ws', 'kafka', 'internal']) satisfies z.ZodType<Protocol>;

export const PaletteKeySchema = z.enum([
  'cyan', 'green', 'amber', 'red', 'violet', 'blue', 'pink',
  'magenta', 'orange', 'teal', 'rose', 'purple', 'emerald',
]) satisfies z.ZodType<PaletteKey>;

export const TechSchema = z.enum([
  'typescript', 'javascript', 'nodejs', 'cplusplus', 'react',
  'nestjs', 'koa', 'moleculer',
  'postgres', 'aerospike', 'redis', 'elastic', 'dynamodb',
  'kafka', 's3', 'webrtc', 'gstreamer',
  'lua', 'go', 'mqtt', 'docker', 'githubactions',
]) satisfies z.ZodType<Tech>;

export const TeamIdSchema = z.enum(['team-shopping', 'team-fulfillment', 'team-engagement']) satisfies z.ZodType<TeamId>;

export const SubServiceSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  sub: z.string(),
  role: z.string(),
  desc: z.string(),
  repo: z.string().optional(),
  tech: z.array(TechSchema).optional(),
}) satisfies z.ZodType<SubService>;

export const ServiceEcosystemSchema = z.strictObject({
  expandable: z.boolean(),
  intakeTopicId: z.string().min(1),
  intakeSubServiceId: z.string().min(1),
  internalEdges: z.array(z.strictObject({ from: z.string().min(1), to: z.string().min(1), proto: ProtocolSchema })),
  egressSubServiceId: z.string().min(1),
}) satisfies z.ZodType<ServiceEcosystem>;

export const ServiceSchema = z.strictObject({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  palette: PaletteKeySchema,
  hex: z.string().regex(HEX_COLOR),
  name: z.string(),
  sub: z.string(),
  code: z.string(),
  lang: z.string(),
  role: z.string(),
  desc: z.string(),
  tech: z.array(TechSchema),
  repo: z.string().optional(),
  team: TeamIdSchema.optional(),
  subServices: z.array(SubServiceSchema).optional(),
  ecosystem: ServiceEcosystemSchema.optional(),
}) satisfies z.ZodType<Service>;

export const TopicSchema = z.strictObject({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  labelSide: z.enum(['above', 'below']).optional(),
  pinned: z.boolean().optional(),
  name: z.string(),
  color: z.string(),
  hex: z.string().regex(HEX_COLOR),
  desc: z.string(),
  groupServiceId: z.string().min(1),
}) satisfies z.ZodType<Topic>;

export const ClusterSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string(),
  serviceIds: z.array(z.string().min(1)).min(1),
  nebula: z.strictObject({
    anchorServiceIds: z.array(z.string().min(1)).min(1),
    base: PaletteKeySchema,
    hot: PaletteKeySchema,
  }),
}) satisfies z.ZodType<Cluster>;

export const StepSchema = z.strictObject({
  phase: z.number().int(),
  from: z.string().min(1),
  to: z.string().min(1),
  via: z.string().optional(),
  through: z.string().optional(),
  type: ProtocolSchema,
  label: z.string(),
  title: z.string(),
  plain: z.string(),
  payload: z.string().optional(),
  parallel: z.boolean().optional(),
}) satisfies z.ZodType<Step>;

const scenarioShape = {
  id: z.string().min(1),
  domain: z.string().min(1),
  phaseId: z.number().int().optional(),
  label: z.string(),
  color: z.string(),
  status: z.enum(['ready', 'soon']),
  short: z.string().optional(),
};

export const ScenarioSchema = z.strictObject(scenarioShape) satisfies z.ZodType<Scenario>;

export const DomainSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string(),
  glyph: z.string(),
  short: z.string(),
}) satisfies z.ZodType<Domain>;

export const IncidentRefSchema = z.strictObject({
  label: z.string(),
  url: z.url(),
}) satisfies z.ZodType<IncidentRef>;

export const IncidentSchema = z.strictObject({
  ...scenarioShape,
  incident: z.literal(true),
  date: z.string().regex(ISO_DATE),
  time: z.string().optional(),
  note: z.string(),
  refs: z.array(IncidentRefSchema).optional(),
  steps: z.array(StepSchema).min(1),
}) satisfies z.ZodType<Incident>;

export const TeamOwnerSchema = z.strictObject({
  label: z.string(),
  color: z.string(),
  hex: z.string().regex(HEX_COLOR),
  githubTeam: z.string(),
  reviewers: z.array(z.string()),
  slack: z.string().optional(),
}) satisfies z.ZodType<TeamOwner>;

const DriftKindSchema = z.enum(['added', 'changed', 'risk', 'removed']);

export const DriftEntrySchema = z.strictObject({
  id: z.string().min(1),
  date: z.string().regex(ISO_DATE),
  kind: DriftKindSchema,
  title: z.string(),
  detail: z.string(),
  team: TeamIdSchema.optional(),
  nodeIds: z.array(z.string()),
  evidence: z.array(z.string()).optional(),
  prNumber: z.number().int().positive().optional(),
  prTitle: z.string().optional(),
  prOwner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.strictObject({ repo: z.string(), sha: z.string(), branch: z.string().optional() }).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
}) satisfies z.ZodType<DriftEntry>;

export const OnCallSchema = z.strictObject({
  handle: z.string(),
  until: z.iso.datetime(),
  slack: z.string(),
}) satisfies z.ZodType<OnCall>;

export const ServiceHealthInputSchema = z.strictObject({
  serviceId: z.string().min(1),
  lastCommit: z.string().regex(ISO_DATE),
  openPrs: z.number().int().nonnegative(),
}) satisfies z.ZodType<ServiceHealthInput>;

export const BrandSchema = z.strictObject({
  tagline: z.string(),
  helpTitle: z.string(),
  repoBaseUrl: z.url(),
  driftSyncUrl: z.url(),
}) satisfies z.ZodType<Brand>;

export const CosmosOwnersSchema = z.strictObject({
  teams: z.record(TeamIdSchema, TeamOwnerSchema),
  fallback: TeamOwnerSchema,
  serviceOverrides: z.record(z.string(), z.strictObject({ reviewers: z.array(z.string()) })),
}) satisfies z.ZodType<CosmosOwners>;

const DataSourceSchema = z.literal('fixture');

export const CosmosDriftSchema = z.strictObject({
  runTimeUtc: z.string().regex(/^\d{2}:\d{2}$/),
  entries: z.array(DriftEntrySchema),
  source: DataSourceSchema,
}) satisfies z.ZodType<CosmosDrift>;

export const CosmosHealthSchema = z.strictObject({
  asOf: z.string().regex(ISO_DATE),
  services: z.array(ServiceHealthInputSchema),
  onCallByTeam: z.record(TeamIdSchema, OnCallSchema),
  source: DataSourceSchema,
}) satisfies z.ZodType<CosmosHealth>;

export const CosmosDemoSchema = z.strictObject({
  allTour: z.strictObject({
    scenarioId: z.string().min(1),
    incidentId: z.string().min(1).nullable(),
    browseDomainId: z.string().min(1),
  }),
  aiTour: z.strictObject({
    domainId: z.string().min(1),
    question: z.string().min(1),
    scriptedAnswer: z.strictObject({
      text: z.string().min(1),
      thinkingMs: z.number().int().nonnegative(),
      wordMs: z.number().int().positive(),
    }),
    highlightServiceIds: z.array(z.string().min(1)).min(1),
    passportNodeId: z.string().min(1),
    citedDriftEntryIds: z.array(z.string().min(1)),
  }),
}) satisfies z.ZodType<CosmosDemo>;

export const CosmosDataSchema = z.strictObject({
  brand: BrandSchema,
  domains: z.array(DomainSchema),
  palette: z.record(PaletteKeySchema, z.string().regex(HEX_COLOR)),
  clusters: z.array(ClusterSchema),
  services: z.array(ServiceSchema),
  topics: z.array(TopicSchema),
  scenarios: z.array(ScenarioSchema),
  steps: z.array(StepSchema),
  incidents: z.array(IncidentSchema),
  owners: CosmosOwnersSchema,
  drift: CosmosDriftSchema,
  health: CosmosHealthSchema,
  demo: CosmosDemoSchema,
}) satisfies z.ZodType<CosmosData>;

const idList = z.array(z.string().min(1));

export const LogicalEdgeSchema = z.strictObject({
  key: z.string().min(1),
  type: ProtocolSchema,
  from: z.string().min(1),
  to: z.string().min(1),
}) satisfies z.ZodType<LogicalEdge>;

export const ServiceLinksSchema = z.strictObject({
  calls: idList,
  publishes: idList,
  consumes: idList,
  domains: idList,
}) satisfies z.ZodType<ServiceLinks>;

export const TopicLinksSchema = z.strictObject({ producers: idList, consumers: idList }) satisfies z.ZodType<TopicLinks>;

export const BlastNodeSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  level: z.enum(['high', 'med', 'low']),
  hops: z.number().int().positive(),
}) satisfies z.ZodType<BlastNode>;

export const BlastResultSchema = z.strictObject({
  sourceId: z.string().min(1),
  levels: z.record(z.string(), z.enum(['source', 'high', 'med', 'low'])),
  dependents: z.array(BlastNodeSchema),
}) satisfies z.ZodType<BlastResult>;

export const ResolvedOwnerSchema = z.strictObject({
  teamId: TeamIdSchema.optional(),
  label: z.string(),
  color: z.string(),
  hex: z.string().regex(HEX_COLOR),
  reviewers: z.array(z.string()),
  githubTeam: z.string().optional(),
  slack: z.string().optional(),
  source: z.enum(['override', 'team', 'fallback']),
}) satisfies z.ZodType<ResolvedOwner>;

export const TeamGroupSchema = z.strictObject({
  teamId: TeamIdSchema.nullable(),
  label: z.string(),
  color: z.string(),
  hex: z.string().regex(HEX_COLOR),
  githubTeam: z.string().optional(),
  slack: z.string().optional(),
  serviceIds: idList,
}) satisfies z.ZodType<TeamGroup>;

export const CosmosOwnershipSchema = z.strictObject({
  byService: z.record(z.string(), ResolvedOwnerSchema),
  teamGroups: z.array(TeamGroupSchema),
}) satisfies z.ZodType<CosmosOwnership>;

export const TopicGroupSchema = z.strictObject({
  id: z.string().min(1),
  serviceId: z.string().min(1),
  memberIds: idList,
}) satisfies z.ZodType<TopicGroup>;

const HealthStatusSchema = z.enum(['fresh', 'warm', 'hot']);

export const ResolvedHealthSchema = z.strictObject({
  ...ServiceHealthInputSchema.shape,
  status: HealthStatusSchema,
  ageDays: z.number(),
  onCall: OnCallSchema.nullable(),
  team: TeamIdSchema.nullable(),
  teamLabel: z.string(),
}) satisfies z.ZodType<ResolvedHealth>;

export const CosmosHealthStatusSchema = z.strictObject({
  byService: z.record(z.string(), ResolvedHealthSchema),
  counts: z.record(HealthStatusSchema, z.number().int().nonnegative()),
}) satisfies z.ZodType<CosmosHealthStatus>;

export const LatestDriftSchema = z.strictObject({
  date: z.string().regex(ISO_DATE).nullable(),
  entries: z.array(DriftEntrySchema),
  byNode: z.record(z.string(), DriftKindSchema),
}) satisfies z.ZodType<LatestDrift>;

export const DriftLinksSchema = z.strictObject({
  prUrl: z.url().nullable(),
  commitUrl: z.url().nullable(),
}) satisfies z.ZodType<DriftLinks>;

export const CosmosPlayableSchema = z.strictObject({
  items: z.array(z.union([IncidentSchema, ScenarioSchema])),
  stepsById: z.record(z.string(), z.array(StepSchema)),
}) satisfies z.ZodType<CosmosPlayable>;

export const CosmosDerivedSchema = z.strictObject({
  asOf: z.string().regex(ISO_DATE),
  edges: z.array(LogicalEdgeSchema),
  connectedNodeIds: idList,
  serviceLinks: z.record(z.string(), ServiceLinksSchema),
  topicLinks: z.record(z.string(), TopicLinksSchema),
  dependentsOf: z.record(z.string(), idList),
  blastRadius: z.record(z.string(), BlastResultSchema),
  ownership: CosmosOwnershipSchema,
  topicGroups: z.array(TopicGroupSchema),
  healthStatus: CosmosHealthStatusSchema,
  latestDrift: LatestDriftSchema,
  driftSearchText: z.record(z.string(), z.string()),
  driftLinks: z.record(z.string(), DriftLinksSchema),
  playable: CosmosPlayableSchema,
}) satisfies z.ZodType<CosmosDerived>;

export const CosmosResponseSchema = z.strictObject({
  version: z.string().regex(/^[0-9a-f]{16}$/),
  data: CosmosDataSchema,
  derived: CosmosDerivedSchema,
}) satisfies z.ZodType<CosmosResponse>;
