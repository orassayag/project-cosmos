/**
 * Edge resolution — given a Step, return the ordered list of edges
 * the packet should travel along.
 *
 *   internal  → 1 edge  (from → to)
 *   ws / http → 1 edge  (from → to)
 *   kafka     → 2 edges (from → via, via → to)
 *   3-hop     → 3 edges (from → via, via → through, through → to)
 *
 * Each leg carries the wire colour (kafka legs are orange, the final
 * WS hop in a 3-hop broadcast is cyan, etc).
 */

import type { Protocol, Service, Step } from '../api/cosmos-api';

export interface EdgeLeg {
  /** Same key shape used in Map.tsx so we can look up the rendered <path>. */
  key: string;
  proto: Protocol;
  from: string;
  to: string;
}

function edgeKey(from: string, to: string, proto: Protocol): string {
  return `${from}→${to}|${proto}`;
}

export function legsForStep(
  step: Step,
  expanded?: Set<string> | null,
  servicesById: Record<string, Service> = {},
): EdgeLeg[] {
  // 3-hop broadcast through a service whose ecosystem is currently expanded →
  // reroute through its sub-services so the packet visibly traverses them.
  const ecosystem = step.through ? servicesById[step.through]?.ecosystem : undefined;
  if (step.via && step.through && ecosystem && expanded?.has(step.through)) {
    return [
      { key: edgeKey(step.from, step.via, 'kafka'), proto: 'kafka', from: step.from, to: step.via },
      {
        key: edgeKey(step.via, ecosystem.intakeSubServiceId, 'kafka'),
        proto: 'kafka',
        from: step.via,
        to: ecosystem.intakeSubServiceId,
      },
      ...ecosystem.internalEdges.map((edge) => ({ key: edgeKey(edge.from, edge.to, edge.proto), ...edge })),
      {
        key: edgeKey(ecosystem.egressSubServiceId, step.to, 'ws'),
        proto: 'ws',
        from: ecosystem.egressSubServiceId,
        to: step.to,
      },
    ];
  }
  if (step.via && step.through) {
    return [
      { key: edgeKey(step.from, step.via, 'kafka'), proto: 'kafka', from: step.from, to: step.via },
      { key: edgeKey(step.via, step.through, 'kafka'), proto: 'kafka', from: step.via, to: step.through },
      { key: edgeKey(step.through, step.to, 'ws'), proto: 'ws', from: step.through, to: step.to },
    ];
  }
  if (step.via) {
    return [
      { key: edgeKey(step.from, step.via, 'kafka'), proto: 'kafka', from: step.from, to: step.via },
      { key: edgeKey(step.via, step.to, 'kafka'), proto: 'kafka', from: step.via, to: step.to },
    ];
  }
  return [{ key: edgeKey(step.from, step.to, step.type), proto: step.type, from: step.from, to: step.to }];
}

export { edgeKey };
