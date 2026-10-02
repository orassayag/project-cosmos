import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * cosmos-check — one pass/fail report for the server-owned-data migration
 * (docs/plans/server-owned-data-migration-plan.md, addition A3).
 *
 *   npm run cosmos:check                 # every check
 *   npm run cosmos:check -- --phase 0    # only checks active by phase 0
 *
 * Paths resolve against the working directory (npm runs scripts from the repo root).
 * Each later phase appends its own entries to COSMOS_CHECKS.
 */

interface CheckBase {
  name: string;
  /** The plan phase that activates this check. */
  phase: number;
}

export type CosmosCheck = CheckBase &
  (
    | { type: 'files-exist'; paths: string[] }
    | { type: 'grep-absent'; pattern: string; pathspecs: string[] }
    | { type: 'grep-present'; pattern: string; pathspecs: string[] }
  );

export interface CheckResult {
  check: CosmosCheck;
  isPassing: boolean;
  offendingFiles: string[];
}

export const COSMOS_CHECKS: CosmosCheck[] = [
  {
    name: 'baseline fixtures exist',
    phase: 0,
    type: 'files-exist',
    paths: [
      'server/src/__tests__/fixtures/baseline-full.json',
      'server/src/__tests__/fixtures/baseline-cosmos-map.json',
    ],
  },
  {
    name: 'baseline screenshots exist',
    phase: 0,
    type: 'files-exist',
    paths: ['docs/plans/baseline-screens/default-map.png', 'docs/plans/baseline-screens/mobile-default-map.png'],
  },
  {
    name: 'decisions log exists',
    phase: 0,
    type: 'files-exist',
    paths: ['docs/plans/server-owned-data-decisions.md'],
  },
  {
    name: 'server cosmos module exists',
    phase: 1,
    type: 'files-exist',
    paths: [
      'server/src/cosmos/apiTypes.ts',
      'server/src/cosmos/schema.ts',
      'server/src/cosmos/validate.ts',
      'server/src/cosmos/index.ts',
    ],
  },
  {
    // server/scripts/snapshot-map.ts still reads the client copy; Phase 11 deletes it.
    name: 'nothing under server/src imports client/ or drift-sync/',
    phase: 1,
    type: 'grep-absent',
    pattern: `['"](\\.\\./)+(client|drift-sync)/`,
    pathspecs: ['server/src'],
  },
  {
    // The plan's Phase 2 grep. Data files, tests and client/src/demo/ (until Phase 9) may still name services.
    name: 'client rendering code names no AstroMart service, topic or domain',
    phase: 2,
    type: 'grep-absent',
    pattern: `storefront|api-gateway|'cart'|'search'|catalog|inventory|'orders'|payments|shipping|notifications|object-storage|realtime-hub|hub-|orders\\.|payments\\.|shopping\\.|fulfillment\\.|engagement\\.|AstroMart`,
    pathspecs: [
      ':(glob)client/src/**/*.ts',
      ':(glob)client/src/**/*.tsx',
      ':(exclude)client/src/scenarios',
      ':(exclude)client/src/incidents',
      ':(exclude)client/src/demo',
      ':(exclude,glob)client/src/**/__tests__/**',
    ],
  },
  {
    name: 'server derive modules and getCosmosView() exist',
    phase: 3,
    type: 'files-exist',
    paths: [
      'server/src/cosmos/view.ts',
      'server/src/cosmos/derive/graph.ts',
      'server/src/cosmos/derive/blastRadius.ts',
      'server/src/cosmos/derive/ownership.ts',
      'server/src/cosmos/derive/health.ts',
      'server/src/cosmos/derive/topicGroups.ts',
      'server/src/cosmos/derive/drift.ts',
      'server/src/cosmos/derive/playable.ts',
    ],
  },
  {
    // Derive functions take the data as an argument; only view.ts wires them to getCosmosData().
    name: 'derive modules are pure: no data or index imports',
    phase: 3,
    type: 'grep-absent',
    pattern: `from ['"]\\.\\./(data/|index\\.js)`,
    pathspecs: [':(glob)server/src/cosmos/derive/*.ts'],
  },
  {
    name: 'derived parity covers blast radius, edges, topic groups, team groups, health, drift and steps',
    phase: 3,
    type: 'grep-present',
    pattern: 'derived values parity with baseline-full\\.json',
    pathspecs: ['server/src/__tests__/cosmosParity.test.ts'],
  },
  {
    name: 'cosmos route, its tests and the build version print exist',
    phase: 4,
    type: 'files-exist',
    paths: [
      'server/src/__tests__/cosmosRoute.test.ts',
      'server/src/__tests__/cosmosIsolation.test.ts',
      'server/scripts/print-cosmos-version.ts',
    ],
  },
  {
    name: 'GET /api/cosmos is registered',
    phase: 4,
    type: 'grep-present',
    pattern: `app\\.get\\('/cosmos'`,
    pathspecs: ['server/src/app.ts'],
  },
  {
    // The AI stack loads lazily inside the /ai/* handlers, so a broken agent cannot take the map down.
    name: 'app.ts has no static import of the agent, LangChain or provider SDKs',
    phase: 4,
    type: 'grep-absent',
    pattern: `^import .* from ['"](\\./agent/|@langchain/|ai['"]|openai|@anthropic-ai/)`,
    pathspecs: ['server/src/app.ts'],
  },
  {
    name: 'server build prints COSMOS_VERSION',
    phase: 4,
    type: 'grep-present',
    pattern: 'print-cosmos-version',
    pathspecs: ['server/package.json'],
  },
  {
    name: 'client API types are emitted from the server',
    phase: 5,
    type: 'files-exist',
    paths: [
      'server/scripts/emit-client-types.ts',
      'server/scripts/__tests__/emitClientTypes.test.ts',
      'client/src/api/cosmos-api.ts',
    ],
  },
  {
    name: 'apiTypes.ts imports nothing',
    phase: 5,
    type: 'grep-absent',
    pattern: `^\\s*(import\\b|export\\b.*\\bfrom\\s*['"])`,
    pathspecs: ['server/src/cosmos/apiTypes.ts'],
  },
  {
    name: 'CosmosResponseSchema is checked against CosmosResponse',
    phase: 5,
    type: 'grep-present',
    pattern: 'satisfies z\\.ZodType<CosmosResponse>',
    pathspecs: ['server/src/cosmos/schema.ts'],
  },
  {
    name: 'CI fails when the client copy of the API types is stale',
    phase: 5,
    type: 'grep-present',
    pattern: 'git diff --exit-code client/src/api/cosmos-api\\.ts',
    pathspecs: ['.github/workflows/validate-on-pr.yml'],
  },
  {
    name: 'server reads the view, not cosmos-map.json (parity test excepted)',
    phase: 6,
    type: 'grep-absent',
    pattern: 'generated/cosmos-map\\.json',
    pathspecs: ['server/src', ':(exclude)server/src/__tests__/cosmosParity.test.ts'],
  },
  {
    name: 'agent eval suite and unknown-action guard exist',
    phase: 6,
    type: 'files-exist',
    paths: ['server/src/__tests__/agentEval.test.ts', 'client/src/__tests__/askUnknownAction.test.ts'],
  },
];

// `--untracked` so files a phase just created count before they are committed.
function gitGrepFiles(cwd: string, pattern: string, pathspecs: string[]): string[] {
  try {
    const output = execFileSync('git', ['grep', '-l', '--untracked', '-E', pattern, '--', ...pathspecs], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return output.split('\n').filter(Boolean);
  } catch (error) {
    // git grep exits 1 when nothing matches; anything else is a real failure.
    if ((error as { status?: number }).status === 1) return [];
    throw new Error(`git grep failed for pattern ${JSON.stringify(pattern)} in ${cwd}`, { cause: error });
  }
}

export function runCheck(check: CosmosCheck, cwd: string): CheckResult {
  switch (check.type) {
    case 'files-exist': {
      const missingPaths = check.paths.filter((path) => !existsSync(resolve(cwd, path)));
      return { check, isPassing: missingPaths.length === 0, offendingFiles: missingPaths };
    }
    case 'grep-absent': {
      const matchingFiles = gitGrepFiles(cwd, check.pattern, check.pathspecs);
      return { check, isPassing: matchingFiles.length === 0, offendingFiles: matchingFiles };
    }
    case 'grep-present': {
      const matchingFiles = gitGrepFiles(cwd, check.pattern, check.pathspecs);
      return {
        check,
        isPassing: matchingFiles.length > 0,
        offendingFiles: matchingFiles.length > 0 ? [] : check.pathspecs,
      };
    }
  }
}

export function runChecks(checks: CosmosCheck[], cwd: string, maxPhase: number = Infinity): CheckResult[] {
  return checks.filter((check) => check.phase <= maxPhase).map((check) => runCheck(check, cwd));
}

export function formatResult(result: CheckResult): string {
  const label = `${result.isPassing ? '✅' : '❌'} [phase ${result.check.phase}] ${result.check.name}`;
  return result.offendingFiles.length > 0 ? `${label} — ${result.offendingFiles.join(', ')}` : label;
}

export function parsePhase(argv: string[]): number {
  const flagIndex = argv.indexOf('--phase');
  if (flagIndex === -1) return Infinity;
  const rawPhase = argv[flagIndex + 1];
  const phase = Number(rawPhase);
  if (rawPhase === undefined || !Number.isInteger(phase) || phase < 0) {
    throw new Error(`--phase expects a non-negative integer, got ${JSON.stringify(rawPhase ?? null)}`);
  }
  return phase;
}

function main(): void {
  const root = process.cwd();
  const maxPhase = parsePhase(process.argv.slice(2));
  const results = runChecks(COSMOS_CHECKS, root, maxPhase);
  for (const result of results) console.log(formatResult(result));
  const failedCount = results.filter((result) => !result.isPassing).length;
  const scope = Number.isFinite(maxPhase) ? `phase ≤ ${maxPhase}` : 'all phases';
  console.log(`\ncosmos-check: ${results.length - failedCount}/${results.length} passing (${scope})`);
  if (failedCount > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
