import { describe, expect, it } from 'vitest';
import { deriveOwnership, groupServicesByTeam, ownerLabel, resolveOwner } from '../ownership.js';
import { makeCosmosData, makeService } from './cosmosFixture.js';

describe('resolveOwner', () => {
  const { owners } = makeCosmosData();

  it('uses the team owner for a service with a team', () => {
    const owner = resolveOwner(owners, makeService('gateway', { team: 'team-shopping' }));
    expect(owner).toMatchObject({ teamId: 'team-shopping', label: owners.teams['team-shopping'].label, source: 'team' });
  });

  it('falls back to the unowned owner for a service without a team', () => {
    const owner = resolveOwner(owners, makeService('bucket'));
    expect(owner).toMatchObject({ label: owners.fallback.label, source: 'fallback' });
    expect(owner.teamId).toBeUndefined();
  });

  it('takes reviewers from a per-service override', () => {
    const ownersWithOverride = { ...owners, serviceOverrides: { gateway: { reviewers: ['reviewer-bot'] } } };
    const owner = resolveOwner(ownersWithOverride, makeService('gateway', { team: 'team-shopping' }));
    expect(owner).toMatchObject({ reviewers: ['reviewer-bot'], source: 'override', teamId: 'team-shopping' });
  });

  it('ownerLabel is the resolved label', () => {
    expect(ownerLabel(owners, makeService('bucket'))).toBe(owners.fallback.label);
  });
});

describe('groupServicesByTeam', () => {
  it('lists teams in declaration order, drops empty teams, and ends with the unowned bucket', () => {
    const data = makeCosmosData();
    const groups = groupServicesByTeam(data.owners, data.services);
    expect(groups.map((group) => [group.teamId, group.serviceIds])).toStrictEqual([
      ['team-shopping', ['gateway']],
      ['team-fulfillment', ['checkout']],
      [null, ['mailer', 'bucket']],
    ]);
    expect(groups.at(-1)).not.toHaveProperty('slack');
  });

  it('has no unowned bucket when every service has a team', () => {
    const data = makeCosmosData();
    const groups = groupServicesByTeam(data.owners, [makeService('gateway', { team: 'team-engagement' })]);
    expect(groups.map((group) => group.teamId)).toStrictEqual(['team-engagement']);
  });
});

describe('deriveOwnership', () => {
  it('resolves every service', () => {
    expect(Object.keys(deriveOwnership(makeCosmosData()).byService)).toStrictEqual([
      'gateway',
      'checkout',
      'mailer',
      'bucket',
    ]);
  });
});
