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
