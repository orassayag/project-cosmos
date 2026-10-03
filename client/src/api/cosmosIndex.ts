import type { CosmosResponse, Incident, Playable, Scenario, Service, Step, Topic } from './cosmos-api';
import { useCosmos } from './CosmosProvider';

/** Id lookups over a loaded response. Indexing only — every system fact comes from `derived`. */
export interface CosmosIndex {
  servicesById: Record<string, Service>;
  topicsById: Record<string, Topic>;
  scenariosById: Record<string, Scenario>;
  incidentsById: Record<string, Incident>;
  playableById: Record<string, Playable>;
  /** Scenario steps, then every incident's steps — every hop the map can draw. */
  allSteps: Step[];
}

const indexByResponse = new WeakMap<CosmosResponse, CosmosIndex>();

function byId<T extends { id: string }>(items: readonly T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export function indexCosmos(response: CosmosResponse): CosmosIndex {
  const cached = indexByResponse.get(response);
  if (cached) return cached;
  const { data, derived } = response;
  const index: CosmosIndex = {
    servicesById: byId(data.services),
    topicsById: byId(data.topics),
    scenariosById: byId(data.scenarios),
    incidentsById: byId(data.incidents),
    playableById: byId(derived.playable.items),
    allSteps: [...data.steps, ...data.incidents.flatMap((incident) => incident.steps)],
  };
  indexByResponse.set(response, index);
  return index;
}

export function useCosmosIndex(): CosmosIndex {
  return indexCosmos(useCosmos());
}

/** Unknown ids play nothing. */
export function stepsFor(response: CosmosResponse, playableId: string): Step[] {
  return response.derived.playable.stepsById[playableId] ?? [];
}

export function nodeKindOf(index: CosmosIndex, nodeId: string): 'service' | 'topic' | null {
  if (index.servicesById[nodeId]) return 'service';
  if (index.topicsById[nodeId]) return 'topic';
  return null;
}

export function nodeName(index: CosmosIndex, nodeId: string): string {
  return index.servicesById[nodeId]?.name ?? index.topicsById[nodeId]?.name ?? nodeId;
}
