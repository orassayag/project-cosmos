import type { CosmosData, CosmosOwners, CosmosOwnership, ResolvedOwner, Service, TeamGroup, TeamId } from '../types.js';

/** Override reviewers win over the team's; a service without a team falls back to the unowned owner. */
export function resolveOwner(owners: CosmosOwners, service: Service): ResolvedOwner {
  const teamMeta = service.team ? owners.teams[service.team] : owners.fallback;
  const override = owners.serviceOverrides[service.id];
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

export function ownerLabel(owners: CosmosOwners, service: Service): string {
  return resolveOwner(owners, service).label;
}

/** Teams in `owners.teams` declaration order, then one unowned bucket; empty groups are dropped. */
export function groupServicesByTeam(owners: CosmosOwners, services: readonly Service[]): TeamGroup[] {
  const teamIds = Object.keys(owners.teams) as TeamId[];
  const serviceIdsByTeam = new Map<TeamId, string[]>(teamIds.map((id) => [id, []]));
  const unownedServiceIds: string[] = [];
  for (const service of services) {
    if (service.team) serviceIdsByTeam.get(service.team)!.push(service.id);
    else unownedServiceIds.push(service.id);
  }

  const groups: TeamGroup[] = teamIds
    .filter((id) => serviceIdsByTeam.get(id)!.length > 0)
    .map((id) => {
      const meta = owners.teams[id];
      return {
        teamId: id,
        label: meta.label,
        color: meta.color,
        hex: meta.hex,
        githubTeam: meta.githubTeam,
        slack: meta.slack,
        serviceIds: serviceIdsByTeam.get(id)!,
      };
    });

  if (unownedServiceIds.length > 0) {
    groups.push({
      teamId: null,
      label: owners.fallback.label,
      color: owners.fallback.color,
      hex: owners.fallback.hex,
      githubTeam: owners.fallback.githubTeam,
      serviceIds: unownedServiceIds,
    });
  }
  return groups;
}

export function deriveOwnership(data: CosmosData): CosmosOwnership {
  return {
    byService: Object.fromEntries(data.services.map((service) => [service.id, resolveOwner(data.owners, service)])),
    teamGroups: groupServicesByTeam(data.owners, data.services),
  };
}
