import type { Service } from './types';

/**
 * Team → reviewer mapping used by the drift-sync agent when it opens
 * Cosmos PRs. The team comes from `Service.team`; the reviewers come
 * from this file. Update the GitHub team slugs + handles to match the
 * org. Slack channels are optional but used by the future Slack hook.
 */
export interface TeamOwner {
  /** Human-readable team name shown in the ownership UI. */
  label: string;
  /** CSS variable reference for the team's color (matches its map cluster). */
  color: string;
  /** Concrete hex of the same hue — for SVG/swatches that can't take CSS vars. */
  hex: string;
  /** GitHub team slug (without the @org/ prefix). */
  githubTeam: string;
  /** Individual GitHub handles — the CODEOWNERS for this team's services. */
  reviewers: string[];
  /** Slack channel for notifications (optional). */
  slack?: string;
}

export type TeamId = NonNullable<Service['team']>;

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

export interface ResolvedOwner {
  /** The service's team id, or undefined for unowned platform infra. */
  teamId?: TeamId;
  label: string;
  color: string;
  hex: string;
  reviewers: string[];
  githubTeam?: string;
  slack?: string;
  source: 'override' | 'team' | 'fallback';
}

export function resolveOwner(service: Service): ResolvedOwner {
  const teamMeta = service.team ? TEAM_OWNERS[service.team] : FALLBACK_OWNER;
  const override = SERVICE_OVERRIDES[service.id];
  return {
    teamId: service.team,
    label: teamMeta.label,
    color: teamMeta.color,
    hex: teamMeta.hex,
    reviewers: override ? override.reviewers : teamMeta.reviewers,
    githubTeam: teamMeta.githubTeam,
    slack: teamMeta.slack,
    source: override ? 'override' : service.team ? 'team' : 'fallback',
  };
}

export interface TeamGroup {
  /** null for the fallback/unowned bucket. */
  teamId: TeamId | null;
  label: string;
  color: string;
  hex: string;
  githubTeam?: string;
  slack?: string;
  /** Service ids owned by this team, in the order services were declared. */
  serviceIds: string[];
}

/**
 * Group services under their owning team for the ownership legend.
 * Teams appear in `TEAM_OWNERS` declaration order, followed by a single
 * "unowned" bucket for services without a team. Empty groups are dropped.
 */
export function groupServicesByTeam(services: Service[]): TeamGroup[] {
  const teamIds = Object.keys(TEAM_OWNERS) as TeamId[];
  const byTeam = new Map<TeamId, string[]>(teamIds.map((id) => [id, []]));
  const unowned: string[] = [];
  for (const service of services) {
    if (service.team) byTeam.get(service.team)!.push(service.id);
    else unowned.push(service.id);
  }

  const groups: TeamGroup[] = teamIds
    .filter((id) => byTeam.get(id)!.length > 0)
    .map((id) => {
      const meta = TEAM_OWNERS[id];
      return {
        teamId: id,
        label: meta.label,
        color: meta.color,
        hex: meta.hex,
        githubTeam: meta.githubTeam,
        slack: meta.slack,
        serviceIds: byTeam.get(id)!,
      };
    });

  if (unowned.length > 0) {
    groups.push({
      teamId: null,
      label: FALLBACK_OWNER.label,
      color: FALLBACK_OWNER.color,
      hex: FALLBACK_OWNER.hex,
      githubTeam: FALLBACK_OWNER.githubTeam,
      serviceIds: unowned,
    });
  }
  return groups;
}
