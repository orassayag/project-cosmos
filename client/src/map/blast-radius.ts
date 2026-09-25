/**
 * Blast radius — "what breaks if I change X" (F14).
 *
 * Answers the reverse-impact question the map is uniquely placed to answer:
 * pick a service or topic, and see everything that would break if you changed
 * it, ranked by how tightly it's coupled.
 *
 * The direction of breakage is not the same as the direction of a call, so we
 * build a dedicated *dependency* graph from the step list rather than reusing
 * the drawn edges:
 *   • A synchronous call `A → B` (http / internal) means A depends on B — change
 *     B's contract and the caller A breaks. The dependency points backwards.
 *   • An async hand-off `A → B` (kafka / ws push) means the consumer B depends on
 *     A's data — change the producer A and the downstream B breaks. Forwards.
 *
 * `DEPENDENTS_OF.get(X)` is therefore "everyone who breaks if X changes", and a
 * breadth-first walk of it gives the blast radius, with BFS depth as the
 * severity: 1 hop = HIGH (directly coupled), 2 = MED, 3+ = LOW.
 */
import { STEPS, SERVICES_BY_ID, TOPICS_BY_ID } from '../scenarios/data';
import type { Protocol } from '../scenarios/types';

export type BlastLevel = 'source' | 'high' | 'med' | 'low';

export interface BlastNode {
  id: string;
  name: string;
  level: Exclude<BlastLevel, 'source'>;
  /** BFS depth from the source — 1 for direct dependents. */
  hops: number;
}

export interface BlastResult {
  sourceId: string;
  levels: Map<string, BlastLevel>;
  /** Dependents sorted by severity then name — what the legend lists. */
  dependents: BlastNode[];
}

/** Presentation metadata per level — hotter = closer to the change. */
export const BLAST_LEVEL_META: Record<BlastLevel, { label: string; hex: string }> = {
  source: { label: 'Changing this', hex: '#8FD3FF' },
  high:   { label: 'High',          hex: '#E8654A' },
  med:    { label: 'Medium',        hex: '#E6C34A' },
  low:    { label: 'Low',           hex: '#5FD08A' },
};

/** kafka + ws are one-way data hand-offs: the consumer depends on the producer. */
const FORWARD_PROTOCOLS: ReadonlySet<Protocol> = new Set<Protocol>(['kafka', 'ws']);

/**
 * dependency graph, built once: node id → the set of nodes that break if it
 * changes. Mirrors `deriveEdges`' expansion of via/through steps into concrete
 * hops so the graph matches what's drawn, only re-oriented by breakage.
 */
const DEPENDENTS_OF: Map<string, Set<string>> = (() => {
  const graph = new Map<string, Set<string>>();
  const addDependent = (changed: string, breaks: string) => {
    if (changed === breaks) return;
    const set = graph.get(changed) ?? new Set<string>();
    set.add(breaks);
    graph.set(changed, set);
  };
  const link = (from: string, to: string, type: Protocol) => {
    // Forward hand-off: `to` (consumer) breaks if `from` (producer) changes.
    // Synchronous call: `from` (caller) breaks if `to` (provider) changes.
    if (FORWARD_PROTOCOLS.has(type)) addDependent(from, to);
    else addDependent(to, from);
  };
  for (const step of STEPS) {
    if (step.via && step.through) {
      link(step.from, step.via, 'kafka');
      link(step.via, step.through, 'kafka');
      link(step.through, step.to, 'ws');
    } else if (step.via) {
      link(step.from, step.via, 'kafka');
      link(step.via, step.to, 'kafka');
    } else {
      link(step.from, step.to, step.type);
    }
  }
  return graph;
})();

function displayName(id: string): string {
  return SERVICES_BY_ID[id]?.name ?? TOPICS_BY_ID[id]?.name ?? id;
}

function levelForHops(hops: number): Exclude<BlastLevel, 'source'> {
  if (hops === 1) return 'high';
  if (hops === 2) return 'med';
  return 'low';
}

/**
 * Breadth-first walk of the dependency graph from `sourceId`. Every reachable
 * node is a dependent; its BFS depth becomes its severity level.
 */
export function computeBlastRadius(sourceId: string): BlastResult {
  const levels = new Map<string, BlastLevel>([[sourceId, 'source']]);
  const dependents: BlastNode[] = [];
  const hopsById = new Map<string, number>([[sourceId, 0]]);

  let frontier = [sourceId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const current of frontier) {
      const hops = hopsById.get(current)! + 1;
      for (const dependent of DEPENDENTS_OF.get(current) ?? []) {
        if (hopsById.has(dependent)) continue;
        hopsById.set(dependent, hops);
        const level = levelForHops(hops);
        levels.set(dependent, level);
        dependents.push({ id: dependent, name: displayName(dependent), level, hops });
        next.push(dependent);
      }
    }
    frontier = next;
  }

  const severityRank: Record<Exclude<BlastLevel, 'source'>, number> = { high: 0, med: 1, low: 2 };
  dependents.sort(
    (a, b) => severityRank[a.level] - severityRank[b.level] || a.name.localeCompare(b.name),
  );

  return { sourceId, levels, dependents };
}
