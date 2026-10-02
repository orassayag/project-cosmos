import type { BlastLevel, BlastNode, BlastResult, CosmosData, Protocol } from '../types.js';
import { expandStepHops } from './graph.js';

/** Kafka and WebSocket hops hand data forward, so the consumer breaks when the producer changes. */
const FORWARD_PROTOCOLS: ReadonlySet<Protocol> = new Set<Protocol>(['kafka', 'ws']);

/**
 * node id → the nodes that break if it changes. A synchronous call `A → B` makes the caller A depend on B,
 * so the dependency points backwards; a forward hand-off makes the consumer depend on the producer.
 * Built from scenario steps only (not incidents), like the client's map.
 */
export function deriveDependentsOf(data: CosmosData): Record<string, string[]> {
  const graph = new Map<string, Set<string>>();
  const addDependent = (changed: string, breaks: string) => {
    if (changed === breaks) return;
    const dependents = graph.get(changed) ?? new Set<string>();
    dependents.add(breaks);
    graph.set(changed, dependents);
  };
  for (const step of data.steps) {
    for (const { from, to, type } of expandStepHops(step)) {
      if (FORWARD_PROTOCOLS.has(type)) addDependent(from, to);
      else addDependent(to, from);
    }
  }
  return Object.fromEntries([...graph].map(([nodeId, dependents]) => [nodeId, [...dependents]]));
}

export function dependentsOf(dependentsByNode: Record<string, string[]>, nodeId: string): string[] {
  return dependentsByNode[nodeId] ?? [];
}

function levelForHops(hops: number): Exclude<BlastLevel, 'source'> {
  if (hops === 1) return 'high';
  if (hops === 2) return 'med';
  return 'low';
}

const SEVERITY_RANK: Record<Exclude<BlastLevel, 'source'>, number> = { high: 0, med: 1, low: 2 };

/** Breadth-first walk of the dependency graph; a dependent's depth is its severity. */
export function computeBlastRadius(
  data: CosmosData,
  dependentsByNode: Record<string, string[]>,
  sourceId: string,
): BlastResult {
  const nameById = new Map<string, string>([
    ...data.topics.map((topic): [string, string] => [topic.id, topic.name]),
    ...data.services.map((service): [string, string] => [service.id, service.name]),
  ]);
  const levels: Record<string, BlastLevel> = { [sourceId]: 'source' };
  const hopsById = new Map<string, number>([[sourceId, 0]]);
  const dependents: BlastNode[] = [];

  let frontier = [sourceId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const current of frontier) {
      const hops = hopsById.get(current)! + 1;
      for (const dependent of dependentsOf(dependentsByNode, current)) {
        if (hopsById.has(dependent)) continue;
        hopsById.set(dependent, hops);
        const level = levelForHops(hops);
        levels[dependent] = level;
        dependents.push({ id: dependent, name: nameById.get(dependent) ?? dependent, level, hops });
        next.push(dependent);
      }
    }
    frontier = next;
  }

  dependents.sort(
    (first, second) =>
      SEVERITY_RANK[first.level] - SEVERITY_RANK[second.level] || first.name.localeCompare(second.name),
  );
  return { sourceId, levels, dependents };
}

/** Blast radius for every service and topic. */
export function deriveBlastRadius(
  data: CosmosData,
  dependentsByNode: Record<string, string[]>,
): Record<string, BlastResult> {
  const nodeIds = [...data.services.map((service) => service.id), ...data.topics.map((topic) => topic.id)];
  return Object.fromEntries(nodeIds.map((id) => [id, computeBlastRadius(data, dependentsByNode, id)]));
}
