import { useMemo } from 'react';

import { SERVICES_BY_ID, TOPICS_BY_ID } from '../scenarios/data';

// A region is a broad zone of the map — one per domain cluster. Its center and
// size are derived from the services that anchor it, so the nebula tracks the
// real layout rather than hand-placed coordinates. `base` is the resting hue;
// `hot` is the color the cloud shifts toward as activity in the zone rises.
interface RegionSpec {
  id: string;
  anchorServiceIds: string[];
  base: string;
  hot: string;
}

const REGION_SPECS: RegionSpec[] = [
  { id: 'ui', anchorServiceIds: ['storefront'], base: '#22d3ee', hot: '#a78bfa' },
  { id: 'shopping', anchorServiceIds: ['api-gateway', 'cart', 'search', 'catalog'], base: '#34d399', hot: '#22d3ee' },
  { id: 'fulfillment', anchorServiceIds: ['orders', 'payments', 'inventory', 'shipping'], base: '#f5b731', hot: '#fb923c' },
  { id: 'engagement', anchorServiceIds: ['realtime-hub', 'notifications'], base: '#e879f9', hot: '#ec4899' },
];

// A single-service zone (UI) collapses to a point without this floor, so give
// every cloud a broad minimum reach — nebulae are diffuse, not tight.
const MIN_RADIUS = 300;
const REGION_PADDING = 190;

interface Region extends RegionSpec {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const REGIONS: Region[] = REGION_SPECS.map((spec) => {
  const nodes = spec.anchorServiceIds.map((id) => SERVICES_BY_ID[id]).filter(Boolean);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2);
    minY = Math.min(minY, n.y - n.height / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  }
  return {
    ...spec,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    rx: Math.max(MIN_RADIUS, (maxX - minX) / 2 + REGION_PADDING),
    ry: Math.max(MIN_RADIUS, (maxY - minY) / 2 + REGION_PADDING),
  };
});

const nodePosition = (id: string): { x: number; y: number } | null => {
  const svc = SERVICES_BY_ID[id];
  if (svc) return { x: svc.x, y: svc.y };
  const topic = TOPICS_BY_ID[id];
  if (topic) return { x: topic.x, y: topic.y };
  return null;
};

// Attribute a node to the region whose center it sits closest to — covers
// topics and any node the anchor lists don't name, so every bit of activity
// lands in exactly one zone.
const nearestRegionId = (x: number, y: number): string => {
  let bestId = REGIONS[0].id;
  let bestDist = Infinity;
  for (const r of REGIONS) {
    const d = (r.cx - x) ** 2 + (r.cy - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestId = r.id;
    }
  }
  return bestId;
};

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
  const intensityByRegion = useMemo(() => {
    const intensity = new Map<string, number>(REGIONS.map((r) => [r.id, FLOOR]));
    const add = (id: string, amount: number) => {
      const pos = nodePosition(id);
      if (!pos) return;
      const regionId = nearestRegionId(pos.x, pos.y);
      intensity.set(regionId, (intensity.get(regionId) ?? FLOOR) + amount);
    };

    if (scenarioNodes) for (const id of scenarioNodes) add(id, SCENARIO_WEIGHT);
    for (const id of shotNodes) add(id, SHOT_WEIGHT);
    if (hoverId) add(hoverId, HOVER_BUMP);
    if (selectionId) add(selectionId, SELECTION_BUMP);

    // Busy ambient traffic lifts the whole sky gently — flows are firing
    // everywhere, not in one zone.
    const ambient = Math.max(0, (density - 1) * 0.09);
    for (const r of REGIONS) {
      intensity.set(r.id, Math.min(1, (intensity.get(r.id) ?? FLOOR) + ambient));
    }
    return intensity;
  }, [scenarioNodes, shotNodes, hoverId, selectionId, density]);

  return (
    <g className="lc-nebula" pointerEvents="none" aria-hidden="true">
      <defs>
        {REGIONS.map((r) => (
          <radialGradient key={`base-${r.id}`} id={`cosmos-nebula-base-${r.id}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={r.base} stopOpacity="0.16" />
            <stop offset="55%" stopColor={r.base} stopOpacity="0.05" />
            <stop offset="100%" stopColor={r.base} stopOpacity="0" />
          </radialGradient>
        ))}
        {REGIONS.map((r) => (
          <radialGradient key={`hot-${r.id}`} id={`cosmos-nebula-hot-${r.id}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={r.hot} stopOpacity="0.34" />
            <stop offset="45%" stopColor={r.hot} stopOpacity="0.14" />
            <stop offset="100%" stopColor={r.hot} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {REGIONS.map((r, i) => {
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
