import type {
  CosmosData,
  CosmosHealthStatus,
  HealthStatus,
  ResolvedHealth,
  ServiceHealthInput,
} from '../types.js';
import { resolveOwner } from './ownership.js';

const MS_PER_DAY = 86_400_000;

/** Whole days between an ISO date and the snapshot anchor, floored and never negative. */
export function daysSinceCommit(lastCommit: string, asOf: string): number {
  const then = Date.parse(`${lastCommit}T00:00:00Z`);
  const now = Date.parse(`${asOf}T00:00:00Z`);
  return Math.max(0, Math.floor((now - then) / MS_PER_DAY));
}

/** Staleness and PR backlog are independent triggers; the worse of the two wins. */
export function statusFor(input: ServiceHealthInput, asOf: string): HealthStatus {
  const ageDays = daysSinceCommit(input.lastCommit, asOf);
  if (ageDays > 21 || input.openPrs >= 6) return 'hot';
  if (ageDays > 7 || input.openPrs >= 3) return 'warm';
  return 'fresh';
}

export function resolveHealth(data: CosmosData, input: ServiceHealthInput): ResolvedHealth {
  const service = data.services.find((candidate) => candidate.id === input.serviceId);
  const team = service?.team ?? null;
  return {
    ...input,
    status: statusFor(input, data.health.asOf),
    ageDays: daysSinceCommit(input.lastCommit, data.health.asOf),
    onCall: team ? data.health.onCallByTeam[team] : null,
    team,
    teamLabel: service ? resolveOwner(data.owners, service).label : data.owners.fallback.label,
  };
}

export function deriveHealthStatus(data: CosmosData): CosmosHealthStatus {
  const byService = Object.fromEntries(data.health.services.map((input) => [input.serviceId, resolveHealth(data, input)]));
  const counts: Record<HealthStatus, number> = { fresh: 0, warm: 0, hot: 0 };
  for (const health of Object.values(byService)) counts[health.status] += 1;
  return { byService, counts };
}
