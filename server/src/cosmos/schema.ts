import { z } from 'zod';
import type {
  Brand,
  Cluster,
  CosmosData,
  CosmosDrift,
  CosmosHealth,
  CosmosOwners,
  Domain,
  DriftEntry,
  Incident,
  IncidentRef,
  OnCall,
  PaletteKey,
  Protocol,
  Scenario,
  Service,
  ServiceEcosystem,
  ServiceHealthInput,
  Step,
  SubService,
  Tech,
  TeamId,
  TeamOwner,
  Topic,
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

export const DriftEntrySchema = z.strictObject({
  id: z.string().min(1),
  date: z.string().regex(ISO_DATE),
  kind: z.enum(['added', 'changed', 'risk', 'removed']),
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

export const CosmosDriftSchema = z.strictObject({
  runTimeUtc: z.string().regex(/^\d{2}:\d{2}$/),
  entries: z.array(DriftEntrySchema),
}) satisfies z.ZodType<CosmosDrift>;

export const CosmosHealthSchema = z.strictObject({
  asOf: z.string().regex(ISO_DATE),
  services: z.array(ServiceHealthInputSchema),
  onCallByTeam: z.record(TeamIdSchema, OnCallSchema),
}) satisfies z.ZodType<CosmosHealth>;

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
}) satisfies z.ZodType<CosmosData>;
