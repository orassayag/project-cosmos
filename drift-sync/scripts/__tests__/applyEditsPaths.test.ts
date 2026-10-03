import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createDispatcher } from '../lib/agent.js';
import { APPLIER_WRITABLE_PATHS, resolveWritePath } from '../lib/write-boundary.js';

describe('applier write boundary', () => {
  let cosmosRoot: string;

  before(() => {
    cosmosRoot = mkdtempSync(join(tmpdir(), 'cosmos-write-boundary-'));
  });

  after(() => {
    rmSync(cosmosRoot, { recursive: true, force: true });
  });

  it('allows only server/src/cosmos/data/', () => {
    assert.deepEqual(APPLIER_WRITABLE_PATHS, ['server/src/cosmos/data/']);
  });

  it('accepts a data file, a nested step file and a repo-name-prefixed path', () => {
    for (const requestedPath of [
      'server/src/cosmos/data/topics.ts',
      'server/src/cosmos/data/steps/shopping.ts',
      `${basename(cosmosRoot)}/server/src/cosmos/data/services.ts`,
    ]) {
      assert.equal(resolveWritePath(cosmosRoot, requestedPath, APPLIER_WRITABLE_PATHS).ok, true, requestedPath);
    }
  });

  it('rejects every path outside server/src/cosmos/data/', () => {
    for (const requestedPath of [
      'client/src/scenarios/topics.ts',
      'client/src/incidents/data.ts',
      'server/src/generated/cosmos-map.json',
      'server/src/cosmos/apiTypes.ts',
      'server/src/cosmos/data',
      'server/src/cosmos/data-extra/topics.ts',
      'server/src/cosmos/data/../validate.ts',
      'drift-sync/cosmos-confirmed.json',
      'drift-sync/scripts/validate.ts',
      '../other-repo/src/index.ts',
      '/etc/passwd',
    ]) {
      assert.equal(resolveWritePath(cosmosRoot, requestedPath, APPLIER_WRITABLE_PATHS).ok, false, requestedPath);
    }
  });

  it('write_file writes inside the boundary and refuses outside it without touching disk', () => {
    const dispatch = createDispatcher(cosmosRoot, { writeRoot: cosmosRoot });

    const accepted = dispatch('write_file', { path: 'server/src/cosmos/data/topics.ts', content: 'export const TOPICS = [];\n' });
    assert.match(accepted, /^OK: /);
    assert.equal(readFileSync(join(cosmosRoot, 'server/src/cosmos/data/topics.ts'), 'utf8'), 'export const TOPICS = [];\n');

    const rejected = dispatch('write_file', { path: 'client/src/scenarios/topics.ts', content: 'stale copy' });
    assert.match(rejected, /^ERROR: .*outside the writable surface/);
    assert.equal(existsSync(join(cosmosRoot, 'client')), false);
  });
});
