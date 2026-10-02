import type { TeamId, TeamOwner } from '../types.js';

/**
 * Team → reviewer mapping used by the drift-sync agent when it opens
 * Project Cosmos PRs. The team comes from `Service.team`; the reviewers come
 * from this file.
 */
export const TEAM_OWNERS: Record<TeamId, TeamOwner> = {
  'team-shopping': {
    label: 'Shopping team',
    color: 'var(--svc-cyan)',
    hex: '#22d3ee',
    githubTeam: 'astromart/team-shopping',
    reviewers: [],
    slack: '#team-shopping',
  },
  'team-fulfillment': {
    label: 'Fulfillment team',
    color: 'var(--svc-amber)',
    hex: '#f5b731',
    githubTeam: 'astromart/team-fulfillment',
    reviewers: [],
    slack: '#team-fulfillment',
  },
  'team-engagement': {
    label: 'Engagement team',
    color: 'var(--svc-pink)',
    hex: '#e879f9',
    githubTeam: 'astromart/team-engagement',
    reviewers: [],
    slack: '#team-engagement',
  },
};

/**
 * Per-service overrides. When a service has a dedicated owner that
 * differs from its team's default, list them here.
 */
export const SERVICE_OVERRIDES: Record<string, { reviewers: string[] }> = {
  // payments: { reviewers: ['pci-review-bot'] },
};

/**
 * Fallback owner when neither override nor team mapping resolves —
 * e.g., for services without a team (platform infra like object-storage)
 * or for services added before owners.ts is updated. Drift-sync PRs land
 * here so they never go to /dev/null.
 */
export const FALLBACK_OWNER: TeamOwner = {
  label: 'Platform · unowned',
  color: 'var(--text-3)',
  hex: '#8a94a6',
  githubTeam: 'astromart/cosmos-maintainers',
  reviewers: [],
};
