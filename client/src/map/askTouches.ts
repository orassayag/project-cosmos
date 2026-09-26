import type { EdgeRecord } from './edge-builder';

type EdgeEnds = Pick<EdgeRecord, 'from' | 'to'>;

export function computeAskTouches(ids: readonly string[], edges: readonly EdgeEnds[]): Set<string> | null {
  if (ids.length === 0) return null;
  const focusIds = new Set(ids);
  const touches = new Set(ids);
  for (const edge of edges) {
    if (focusIds.has(edge.from) || focusIds.has(edge.to)) {
      touches.add(edge.from);
      touches.add(edge.to);
    }
  }
  return touches;
}
