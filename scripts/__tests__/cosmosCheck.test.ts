import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { type CosmosCheck, formatResult, parsePhase, runChecks } from '../cosmos-check.js';

const SCRIPT_PATH = resolve(import.meta.dirname, '../cosmos-check.ts');

describe('cosmos-check runner', () => {
  let repoDir: string;

  before(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'cosmos-check-'));
    execFileSync('git', ['init', '--quiet'], { cwd: repoDir });
    mkdirSync(join(repoDir, 'client/src'), { recursive: true });
    writeFileSync(join(repoDir, 'client/src/clean.ts'), 'export const value = 1;\n');
    writeFileSync(join(repoDir, 'client/src/leaky.ts'), "export const id = 'payments';\n");
  });

  after(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  const checks: CosmosCheck[] = [
    { name: 'no hardcoded ids', phase: 2, type: 'grep-absent', pattern: "'payments'", pathspecs: ['client/src'] },
    { name: 'clean module present', phase: 0, type: 'grep-present', pattern: 'value = 1', pathspecs: ['client/src'] },
  ];

  it('reports the passing grep check and lists the offending file of the failing one', () => {
    const [failing, passing] = runChecks(checks, repoDir);
    assert.equal(failing.isPassing, false);
    assert.deepEqual(failing.offendingFiles, ['client/src/leaky.ts']);
    assert.equal(formatResult(failing), "❌ [phase 2] no hardcoded ids — client/src/leaky.ts");
    assert.equal(passing.isPassing, true);
    assert.deepEqual(passing.offendingFiles, []);
  });

  it('skips checks activated by a later phase', () => {
    const results = runChecks(checks, repoDir, 0);
    assert.deepEqual(results.map((result) => result.check.name), ['clean module present']);
  });

  it('lists missing paths for a files-exist check', () => {
    const [result] = runChecks(
      [{ name: 'fixtures', phase: 0, type: 'files-exist', paths: ['client/src/clean.ts', 'missing.json'] }],
      repoDir,
    );
    assert.equal(result.isPassing, false);
    assert.deepEqual(result.offendingFiles, ['missing.json']);
  });

  it('lists paths that still exist for a files-absent check', () => {
    const [result] = runChecks(
      [{ name: 'deleted', phase: 11, type: 'files-absent', paths: ['client/src/leaky.ts', 'client/src/gone'] }],
      repoDir,
    );
    assert.equal(result.isPassing, false);
    assert.deepEqual(result.offendingFiles, ['client/src/leaky.ts']);
  });

  it('rejects a malformed --phase value', () => {
    assert.equal(parsePhase([]), Infinity);
    assert.equal(parsePhase(['--phase', '3']), 3);
    assert.throws(() => parsePhase(['--phase', 'two']), /non-negative integer/);
  });

  it('exits non-zero from the CLI and names the missing files when an active check fails', () => {
    const tsxBin = resolve(import.meta.dirname, '../../node_modules/.bin/tsx');
    assert.throws(
      () => execFileSync(tsxBin, [SCRIPT_PATH, '--phase', '0'], { cwd: repoDir, encoding: 'utf8', stdio: 'pipe' }),
      (error: { status?: number; stdout?: string }) =>
        error.status === 1 && Boolean(error.stdout?.includes('❌ [phase 0] decisions log exists — docs/plans/server-owned-data-decisions.md')),
    );
  });
});
