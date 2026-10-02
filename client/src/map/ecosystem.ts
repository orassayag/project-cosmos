import { ALL_STEPS } from '../scenarios/data';
import type { EcosystemEdge, Protocol, Service, ServiceEcosystem } from '../scenarios/types';
import { buildPathBetween, subPosition } from './edge-builder';
import type { PosOverrides } from './edge-builder';
import { edgeKey } from './edge-resolver';

export interface EcosystemEdgePath {
  key: string;
  d: string;
  type: Protocol;
}

interface Point {
  id: string;
  x: number;
  y: number;
}

/** Sub-services every broadcast through the ecosystem passes; the rest are consulted out-of-band. */
export function ecosystemPathSubIds(ecosystem: ServiceEcosystem): Set<string> {
  return new Set([
    ecosystem.intakeSubServiceId,
    ...ecosystem.internalEdges.flatMap((edge) => [edge.from, edge.to]),
    ecosystem.egressSubServiceId,
  ]);
}

/** Every node any step delivers to through this service. */
export function ecosystemDestinationIds(serviceId: string): Set<string> {
  return new Set(ALL_STEPS.filter((step) => step.through === serviceId).map((step) => step.to));
}

// A hop that has a return hop bows to one side and the return to the other, so the pair never overlaps.
function bendFor(edge: EcosystemEdge, edges: EcosystemEdge[]): number {
  const returnIndex = edges.findIndex((other) => other.from === edge.to && other.to === edge.from);
  if (returnIndex < 0) return 0;
  return edges.indexOf(edge) < returnIndex ? 1 : -1;
}

/** Edges drawn inside an expanded ecosystem: intake topic → sub-services → each destination. */
export function buildEcosystemEdges(
  service: Service,
  ecosystem: ServiceEcosystem,
  overrides: PosOverrides,
  intakeTopic: Point | undefined,
  destinations: Point[],
): EcosystemEdgePath[] | null {
  const intake = subPosition(service.id, ecosystem.intakeSubServiceId, overrides);
  const egress = subPosition(service.id, ecosystem.egressSubServiceId, overrides);
  if (!intake || !egress || !intakeTopic) return null;

  const edges: EcosystemEdgePath[] = [
    {
      key: edgeKey(intakeTopic.id, ecosystem.intakeSubServiceId, 'kafka'),
      d: buildPathBetween(intakeTopic.x, intakeTopic.y, intake.x, intake.y, 0),
      type: 'kafka',
    },
  ];
  for (const edge of ecosystem.internalEdges) {
    const from = subPosition(service.id, edge.from, overrides);
    const to = subPosition(service.id, edge.to, overrides);
    if (!from || !to) return null;
    edges.push({
      key: edgeKey(edge.from, edge.to, edge.proto),
      d: buildPathBetween(from.x, from.y, to.x, to.y, bendFor(edge, ecosystem.internalEdges)),
      type: edge.proto,
    });
  }
  for (const destination of destinations) {
    edges.push({
      key: edgeKey(ecosystem.egressSubServiceId, destination.id, 'ws'),
      d: buildPathBetween(egress.x, egress.y, destination.x, destination.y, 1),
      type: 'ws',
    });
  }
  return edges;
}
