#!/usr/bin/env node
/**
 * fresh-start — replace the AstroMart demo universe with a minimal
 * two-star starter cosmos, ready for your own services.
 *
 *   pnpm fresh
 *
 * Overwrites the server-owned data in server/src/cosmos/data/ (brand, domains, clusters,
 * services, topics, scenarios, owners, steps/, incidents/, demo tours, and empty drift and
 * health), narrows the TeamId union to the starter team, then re-emits the client API types.
 * Irreversible except via git.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = (relativePath) => resolve(root, 'server/src/cosmos/data', relativePath);
const cosmosPath = (relativePath) => resolve(root, 'server/src/cosmos', relativePath);

writeFileSync(dataPath('brand.ts'), `import type { Brand } from '../types.js';

/** Universe branding — the strings that name YOUR system in the UI. */
export const BRAND: Brand = {
  /** Description on the intro screen under the logo. */
  tagline:
    'A live map of your architecture. Pick a domain, pick a scenario, watch the request travel along constellations of services and topics.',
  /** Headline of the help overlay. */
  helpTitle: 'A live map of your platform.',
  /** Base URL for \`Service.repo\` links (no trailing slash). */
  repoBaseUrl: 'https://github.com/your-org',
  /** Link to the nightly Drift Sync workflow runs (the "last run" summary). */
  driftSyncUrl: 'https://github.com/your-org/your-cosmos/actions/workflows/cosmos-sync.yml',
};
`);

writeFileSync(dataPath('domains.ts'), `import type { Domain } from '../types.js';

export const DOMAINS: Domain[] = [
  { id: 'core', label: 'Core', glyph: '·', short: 'Your first domain — rename or add more.' },
];
`);

writeFileSync(dataPath('clusters.ts'), `import type { Cluster } from '../types.js';

// Array order is the backdrop paint order and the nebula's drift-phase order.
export const CLUSTERS: Cluster[] = [
  {
    id: 'core',
    label: 'Core',
    serviceIds: ['web-app', 'api'],
    nebula: { anchorServiceIds: ['web-app', 'api'], base: 'cyan', hot: 'blue' },
  },
];
`);

writeFileSync(dataPath('services.ts'), `import type { Service } from '../types.js';

// \`palette\` names a key of data/palette.ts; \`hex\` must equal that key's value.
export const SERVICES: Service[] = [
  {
    id: 'web-app',
    x: 500, y: 700, width: 220, height: 66,
    palette: 'cyan', hex: '#22d3ee',
    name: 'web-app', sub: 'Your frontend',
    code: 'WEB-01', lang: 'TypeScript', team: 'team-core',
    role: 'The browser-facing surface',
    desc: \`Replace me: your user-facing app. Calls api over HTTP.
Use the /add-service skill (or copy this shape) to grow the map.\`,
    tech: ['typescript', 'react'],
  },
  {
    id: 'api',
    x: 1300, y: 700, width: 220, height: 66,
    palette: 'blue', hex: '#4f8ff7',
    name: 'api', sub: 'Your first backend',
    code: 'API-01', lang: 'TypeScript', team: 'team-core',
    role: 'First star of your galaxy',
    desc: \`Replace me: your first backend service. Receives HTTP from web-app.\`,
    tech: ['typescript', 'nodejs'],
  },
];
`);

writeFileSync(dataPath('topics.ts'), `import type { Topic } from '../types.js';

// Every topic names its \`groupServiceId\`: the service whose topic group it orbits.
export const TOPICS: Topic[] = [];
`);

writeFileSync(dataPath('scenarios.ts'), `import type { Scenario } from '../types.js';

// \`phaseId\` is global and unique across scenarios and incidents; every step's \`phase\` equals it.
export const SCENARIOS: Scenario[] = [
  {
    id: 'core.hello-cosmos', domain: 'core', phaseId: 1,
    label: 'Hello, cosmos', color: 'var(--svc-cyan)', status: 'ready',
    short: 'The starter flow — one request from your web app to your API.',
  },
];
`);

writeFileSync(dataPath('owners.ts'), `import type { TeamId, TeamOwner } from '../types.js';

/** Team → reviewer mapping Drift Sync uses when it opens Project Cosmos PRs. */
export const TEAM_OWNERS: Record<TeamId, TeamOwner> = {
  'team-core': {
    label: 'Core team',
    color: 'var(--svc-cyan)',
    hex: '#22d3ee',
    githubTeam: 'your-org/team-core',
    reviewers: [],
    slack: '#team-core',
  },
};

export const SERVICE_OVERRIDES: Record<string, { reviewers: string[] }> = {};

/** Owner for services without a team, so Drift Sync PRs always reach someone. */
export const FALLBACK_OWNER: TeamOwner = {
  label: 'Platform · unowned',
  color: 'var(--text-3)',
  hex: '#8a94a6',
  githubTeam: 'your-org/cosmos-maintainers',
  reviewers: [],
};
`);

writeFileSync(dataPath('drift.ts'), `import type { DataSource, DriftEntry } from '../types.js';

export const DRIFT_SOURCE: DataSource = 'fixture';

/** The nightly Drift Sync cron time (UTC) every run is stamped with. */
export const DRIFT_RUN_TIME_UTC = '04:17';

/** Drift history, newest run first. Empty until you record your own. */
export const DRIFT_ENTRIES: DriftEntry[] = [];
`);

writeFileSync(dataPath('health.ts'), `import type { DataSource, OnCall, ServiceHealthInput, TeamId } from '../types.js';

export const HEALTH_SOURCE: DataSource = 'fixture';

/** The date the health rows below were captured — commit age is measured from it. */
export const HEALTH_AS_OF = '${new Date().toISOString().slice(0, 10)}';

/** One rotation per team (the type requires it). Replace the placeholder with your own. */
export const ON_CALL_BY_TEAM: Record<TeamId, OnCall> = {
  'team-core': { handle: 'your-handle', until: '${new Date().toISOString().slice(0, 10)}T18:00:00Z', slack: '#team-core' },
};

/** Health rows, one per repo-backed service. Empty until you record your own. */
export const SERVICE_HEALTH: ServiceHealthInput[] = [];
`);

writeFileSync(dataPath('demo.ts'), `import type { CosmosDemo } from '../types.js';

/** What the scripted \`?demo=all\` and \`?demo=ai\` tours show. */
export const DEMO: CosmosDemo = {
  allTour: {
    scenarioId: 'core.hello-cosmos',
    incidentId: null,
    browseDomainId: 'core',
  },
  aiTour: {
    domainId: 'core',
    question: 'What does the api service do?',
    scriptedAnswer: {
      text: 'The api service is the first backend of this cosmos: web-app calls it over HTTP with GET /hello. Replace both with your own services.',
      thinkingMs: 1500,
      wordMs: 90,
    },
    highlightServiceIds: ['api', 'web-app'],
    passportNodeId: 'api',
    citedDriftEntryIds: [],
  },
};
`);

rmSync(dataPath('steps'), { recursive: true, force: true });
mkdirSync(dataPath('steps'));
writeFileSync(dataPath('steps/core.ts'), `import type { Step } from '../../types.js';

export const CORE_STEPS: Step[] = [
  // ─── Phase 1 — Core · Hello, cosmos ────────────────────────────────
  { phase: 1, from: 'web-app', to: 'api', type: 'http',
    label: 'GET /hello', title: 'web-app → api: the first request',
    plain: \`Your first hop. Replace this scenario with a real flow — the
/add-scenario skill traces one from your source code.\`,
    payload: \`GET /api/v1/hello
Headers:
  Accept: application/json

// 200 OK
{ "message": "hello, cosmos" }\` },
  { phase: 1, from: 'api', to: 'api', type: 'internal',
    label: 'Do something real', title: 'api: your logic here',
    plain: \`An internal step — rendered as a self-loop pulse on the capsule.\` },
];
`);
writeFileSync(dataPath('steps/index.ts'), `import type { Step } from '../../types.js';
import { CORE_STEPS } from './core.js';

export const STEPS: Step[] = [...CORE_STEPS];
`);

rmSync(dataPath('incidents'), { recursive: true, force: true });
mkdirSync(dataPath('incidents'));
writeFileSync(dataPath('incidents/index.ts'), `import type { Incident } from '../../types.js';

/** Recorded production incidents (frozen scenarios with inline steps). None yet. */
export const INCIDENTS: Incident[] = [];
`);

// TeamId is a closed union in the API types and its Zod enum — narrow both to the starter team.
const narrowTeamIds = (relativePath, pattern, replacement) => {
  const filePath = cosmosPath(relativePath);
  const source = readFileSync(filePath, 'utf8');
  if (!pattern.test(source)) throw new Error(`fresh-start: could not find the TeamId declaration in ${relativePath}`);
  writeFileSync(filePath, source.replace(pattern, replacement));
};
narrowTeamIds('apiTypes.ts', /export type TeamId = [^;]*;/, "export type TeamId = 'team-core';");
narrowTeamIds('schema.ts', /export const TeamIdSchema = z\.enum\(\[[^\]]*\]\)/, "export const TeamIdSchema = z.enum(['team-core'])");

execFileSync('pnpm', ['types:emit'], { cwd: root, stdio: 'inherit' });

console.log(`✦ Fresh cosmos ready: 2 services, 1 scenario ("Hello, cosmos").
  Next:
    server/src/cosmos/data/brand.ts  # name your universe + set your GitHub org
    pnpm validate                    # check the data's invariants
    pnpm dev                         # see your minimal galaxy
    /add-service <name>              # grow it with Claude Code`);
