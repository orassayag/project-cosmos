import { describe, expect, it } from 'vitest';
import type { Brand, DriftEntry } from '../../types.js';
import {
  deriveLatestDrift,
  driftBranch,
  driftCommitUrl,
  driftPrName,
  driftPrUrl,
  driftSearchText,
  searchDrift,
} from '../drift.js';

function makeEntry(id: string, overrides: Partial<DriftEntry> = {}): DriftEntry {
  return { id, date: '2026-08-13', kind: 'added', title: `Title ${id}`, detail: '', nodeIds: [], ...overrides };
}

const BRAND: Brand = {
  tagline: '',
  helpTitle: '',
  repoBaseUrl: 'https://github.com/example-org',
  driftSyncUrl: 'https://github.com/example-org/cosmos/actions/workflows/sync.yml',
};

describe('deriveLatestDrift', () => {
  it('keeps only the newest run and the most severe kind per node', () => {
    const entries = [
      makeEntry('old', { date: '2026-08-01', kind: 'risk', nodeIds: ['gateway'] }),
      makeEntry('added', { kind: 'added', nodeIds: ['gateway', 'checkout'] }),
      makeEntry('removed', { kind: 'removed', nodeIds: ['gateway'] }),
      makeEntry('changed', { kind: 'changed', nodeIds: ['gateway', 'checkout'] }),
    ];
    const latest = deriveLatestDrift(entries);
    expect(latest.date).toBe('2026-08-13');
    expect(latest.entries.map((entry) => entry.id)).toStrictEqual(['added', 'removed', 'changed']);
    expect(latest.byNode).toStrictEqual({ gateway: 'removed', checkout: 'changed' });
  });

  it('is empty without history', () => {
    expect(deriveLatestDrift([])).toStrictEqual({ date: null, entries: [], byNode: {} });
  });
});

describe('driftBranch and driftPrName', () => {
  it('default to main and to the entry title', () => {
    const entry = makeEntry('plain');
    expect(driftBranch(entry)).toBe('main');
    expect(driftPrName(entry)).toBe('Title plain');
    expect(driftPrName({ ...entry, prTitle: 'PR title' })).toBe('PR title');
  });
});

describe('searchDrift', () => {
  const entries = [
    makeEntry('tagged', {
      kind: 'risk',
      team: 'team-shopping',
      prNumber: 42,
      prOwner: 'Some-Owner',
      tags: ['Coupling'],
      source: { repo: 'search', sha: 'abc1234', branch: 'perf/backfill' },
    }),
    makeEntry('bare', { detail: 'Nothing special' }),
  ];
  const searchTextById = Object.fromEntries(entries.map((entry) => [entry.id, driftSearchText(entry)]));
  const matchIds = (query: string) => searchDrift(entries, searchTextById, query).map((entry) => entry.id);

  it('matches every entry for a blank query', () => {
    expect(matchIds('   ')).toStrictEqual(['tagged', 'bare']);
  });

  it.each([
    ['pr #42', ['tagged']],
    ['COUPLING', ['tagged']],
    ['some-owner', ['tagged']],
    ['team-shopping', ['tagged']],
    ['abc1234', ['tagged']],
    ['perf/backfill', ['tagged']],
    ['risk', ['tagged']],
    ['main', ['bare']],
    ['added', ['bare']],
    ['special', ['bare']],
    ['title', ['tagged', 'bare']],
    ['missing', []],
  ])('query %j matches %j', (query, expected) => {
    expect(matchIds(query)).toStrictEqual(expected);
  });
});

describe('drift URLs', () => {
  it('builds the PR link from the Drift Sync repo and the commit link from the source repo', () => {
    const entry = makeEntry('linked', { prNumber: 7, source: { repo: 'orders', sha: 'e4f5a6b' } });
    expect(driftPrUrl(BRAND, entry)).toBe('https://github.com/example-org/cosmos/pull/7');
    expect(driftCommitUrl(BRAND, entry)).toBe('https://github.com/example-org/orders/commit/e4f5a6b');
  });

  it('is null when the entry has no PR or source', () => {
    expect(driftPrUrl(BRAND, makeEntry('bare'))).toBeNull();
    expect(driftCommitUrl(BRAND, makeEntry('bare'))).toBeNull();
  });
});
