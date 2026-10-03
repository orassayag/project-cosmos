import { useMemo } from 'react';

import type { Cluster, PaletteKey, Service } from '../api/cosmos-api';
import { useCosmos } from '../api/CosmosProvider';
import { useCosmosIndex } from '../api/cosmosIndex';
import type { CosmosIndex } from '../api/cosmosIndex';

// A region is a broad zone of the map — one per cluster. Its center and
// size are derived from the services that anchor it, so the nebula tracks the
// real layout rather than hand-placed coordinates. `base` is the resting hue;
// `hot` is the color the cloud shifts toward as activity in the zone rises.
interface RegionSpec {
  id: string;
  anchorServiceIds: string[];
  base: string;
  hot: string;
}

// A single-service zone collapses to a point without this floor, so give
// every cloud a broad minimum reach — nebulae are diffuse, not tight.
const MIN_RADIUS = 300;
const REGION_PADDING = 190;

interface Region extends RegionSpec {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

function buildRegions(
  clusters: readonly Cluster[],
  servicesById: Record<string, Service>,
  palette: Record<PaletteKey, string>,
): Region[] {
  return clusters.map((cluster) => {
    const nodes = cluster.nebula.anchorServiceIds.map((id) => servicesById[id]).filter(Boolean);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.width / 2);
      minY = Math.min(minY, n.y - n.height / 2);
      maxX = Math.max(maxX, n.x + n.width / 2);
      maxY = Math.max(maxY, n.y + n.height / 2);
    }
    return {
      id: cluster.id,
      anchorServiceIds: cluster.nebula.anchorServiceIds,
      base: palette[cluster.nebula.base],
      hot: palette[cluster.nebula.hot],
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      rx: Math.max(MIN_RADIUS, (maxX - minX) / 2 + REGION_PADDING),
      ry: Math.max(MIN_RADIUS, (maxY - minY) / 2 + REGION_PADDING),
    };
  });
}

function nodePosition(index: CosmosIndex, id: string): { x: number; y: number } | null {
  const node = index.servicesById[id] ?? index.topicsById[id];
  return node ? { x: node.x, y: node.y } : null;
}

// Attribute a node to the region whose center it sits closest to — covers
// topics and any node the anchor lists don't name, so every bit of activity
// lands in exactly one zone.
function nearestRegionId(regions: readonly Region[], x: number, y: number): string {
  let bestId = regions[0].id;
  let bestDist = Infinity;
  for (const r of regions) {
    const d = (r.cx - x) ** 2 + (r.cy - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestId = r.id;
    }
  }
  return bestId;
}

interface NebulaFieldProps {
  /** Path nodes of the active scenario — the flow currently laid out. */
  scenarioNodes: Set<string> | null;
  /** Nodes touched by the live comet shot — the flow actually playing now. */
  shotNodes: Set<string>;
  /** Service under the cursor — a viewer's attention resting on a zone. */
  hoverId: string | null;
  /** Selected service/topic — a viewer dwelling on a zone. */
  selectionId: string | null;
  /** Ambient-traffic multiplier (1 = default). Lifts every zone a little when
   *  lots of background flows are in flight. */
  density: number;
}

// Per-signal weight toward a zone's [0,1] activity level. Tuned so a resting
// map barely glows and a busy zone reads clearly without washing out the nodes.
const SCENARIO_WEIGHT = 0.16;
const SHOT_WEIGHT = 0.2;
const HOVER_BUMP = 0.34;
const SELECTION_BUMP = 0.26;
const FLOOR = 0.06;

/**
 * Soft nebula layer behind the whole map. One diffuse colored cloud per domain
 * zone, resting near-invisible. As flows play, or a viewer's attention settles,
 * the cloud in that zone slowly brightens and shifts toward its "hot" hue.
 * Pure atmosphere — pointer-events off, no labels, no information.
 */
export function NebulaField({ scenarioNodes, shotNodes, hoverId, selectionId, density }: NebulaFieldProps) {
  const { version, data } = useCosmos();
  const index = useCosmosIndex();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the layout changes only with a new response version
  const regions = useMemo(() => buildRegions(data.clusters, index.servicesById, data.palette), [version]);
  const intensityByRegion = useMemo(() => {
    const intensity = new Map<string, number>(regions.map((r) => [r.id, FLOOR]));
    if (regions.length === 0) return intensity;
    const add = (id: string, amount: number) => {
      const pos = nodePosition(index, id);
      if (!pos) return;
      const regionId = nearestRegionId(regions, pos.x, pos.y);
      intensity.set(regionId, (intensity.get(regionId) ?? FLOOR) + amount);
    };

    if (scenarioNodes) for (const id of scenarioNodes) add(id, SCENARIO_WEIGHT);
    for (const id of shotNodes) add(id, SHOT_WEIGHT);
    if (hoverId) add(hoverId, HOVER_BUMP);
    if (selectionId) add(selectionId, SELECTION_BUMP);

    // Busy ambient traffic lifts the whole sky gently — flows are firing
    // everywhere, not in one zone.
    const ambient = Math.max(0, (density - 1) * 0.09);
    for (const r of regions) {
      intensity.set(r.id, Math.min(1, (intensity.get(r.id) ?? FLOOR) + ambient));
    }
    return intensity;
  }, [regions, index, scenarioNodes, shotNodes, hoverId, selectionId, density]);

  return (
    <g className="lc-nebula" pointerEvents="none" aria-hidden="true">
      <defs>
        {regions.map((r) => (
          <radialGradient key={`base-${r.id}`} id={`cosmos-nebula-base-${r.id}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={r.base} stopOpacity="0.16" />
            <stop offset="55%" stopColor={r.base} stopOpacity="0.05" />
            <stop offset="100%" stopColor={r.base} stopOpacity="0" />
          </radialGradient>
        ))}
        {regions.map((r) => (
          <radialGradient key={`hot-${r.id}`} id={`cosmos-nebula-hot-${r.id}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={r.hot} stopOpacity="0.34" />
            <stop offset="45%" stopColor={r.hot} stopOpacity="0.14" />
            <stop offset="100%" stopColor={r.hot} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {regions.map((r, i) => {
        const intensity = intensityByRegion.get(r.id) ?? FLOOR;
        return (
          <g
            key={r.id}
            className="lc-nebula-blob"
            style={{ ['--nebula-phase' as string]: `${i * -6}s` }}
          >
            <g
              className="lc-nebula-blob-core"
              style={{
                transform: `scale(${1 + intensity * 0.14})`,
                transformBox: 'fill-box',
                transformOrigin: 'center',
                opacity: 0.55 + intensity * 0.45,
                transition: 'opacity 900ms ease, transform 1200ms cubic-bezier(0.2, 0.9, 0.3, 1.1)',
              }}
            >
              <ellipse cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} fill={`url(#cosmos-nebula-base-${r.id})`} />
              <ellipse
                cx={r.cx}
                cy={r.cy}
                rx={r.rx}
                ry={r.ry}
                fill={`url(#cosmos-nebula-hot-${r.id})`}
                style={{ opacity: intensity, transition: 'opacity 900ms ease' }}
              />
            </g>
          </g>
        );
      })}
    </g>
  );
}
