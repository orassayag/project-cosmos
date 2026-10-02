import { describe, expect, it } from 'vitest';
import { daysSinceCommit, deriveHealthStatus, resolveHealth, statusFor } from '../health.js';
import { makeCosmosData } from './cosmosFixture.js';

const AS_OF = '2026-08-14';

describe('daysSinceCommit', () => {
  it('counts whole days and never goes negative', () => {
    expect(daysSinceCommit('2026-08-02', AS_OF)).toBe(12);
    expect(daysSinceCommit('2026-08-20', AS_OF)).toBe(0);
  });
});

describe('statusFor', () => {
  it.each([
    ['2026-08-14', 0, 'fresh'],
    ['2026-08-07', 0, 'fresh'],
    ['2026-08-06', 0, 'warm'],
    ['2026-08-14', 3, 'warm'],
    ['2026-07-23', 0, 'hot'],
    ['2026-08-14', 6, 'hot'],
  ] as const)('last commit %s with %i open PRs is %s', (lastCommit, openPrs, expected) => {
    expect(statusFor({ serviceId: 'gateway', lastCommit, openPrs }, AS_OF)).toBe(expected);
  });
});

describe('resolveHealth', () => {
  const data = makeCosmosData();

  it('attaches the team on-call and label for a team service', () => {
    const health = resolveHealth(data, { serviceId: 'gateway', lastCommit: '2026-08-10', openPrs: 1 });
    expect(health).toMatchObject({
      status: 'fresh',
      ageDays: 4,
      team: 'team-shopping',
      onCall: data.health.onCallByTeam['team-shopping'],
      teamLabel: data.owners.teams['team-shopping'].label,
    });
  });

  it('has no on-call and the fallback label for an unowned or unknown service', () => {
    for (const serviceId of ['bucket', 'ghost']) {
      expect(resolveHealth(data, { serviceId, lastCommit: AS_OF, openPrs: 0 })).toMatchObject({
        team: null,
        onCall: null,
        teamLabel: data.owners.fallback.label,
      });
    }
  });
});

describe('deriveHealthStatus', () => {
  it('resolves every health row and counts services per status', () => {
    const data = makeCosmosData({
      health: {
        ...makeCosmosData().health,
        asOf: AS_OF,
        services: [
          { serviceId: 'gateway', lastCommit: AS_OF, openPrs: 0 },
          { serviceId: 'checkout', lastCommit: AS_OF, openPrs: 9 },
          { serviceId: 'mailer', lastCommit: AS_OF, openPrs: 7 },
        ],
      },
    });
    const { byService, counts } = deriveHealthStatus(data);
    expect(Object.keys(byService)).toStrictEqual(['gateway', 'checkout', 'mailer']);
    expect(counts).toStrictEqual({ fresh: 1, warm: 0, hot: 2 });
  });
});
