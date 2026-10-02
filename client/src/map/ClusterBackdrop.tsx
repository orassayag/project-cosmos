import { PALETTE } from '../scenarios/palette';
import type { Cluster, Service } from '../scenarios/types';

interface GradientStop {
  offset: string;
  color: string;
  opacity: string;
}

interface ClusterStyle {
  padX: number;
  padY: number;
  stops: GradientStop[];
  stroke: string;
  textFill: string;
}

// Hand-tuned looks for the clusters the map ships with; any other cluster gets
// a look built from its nebula hues.
const CLUSTER_STYLES: Record<string, ClusterStyle> = {
  ui: {
    padX: 90,
    padY: 110,
    stops: [
      { offset: '0%', color: '#22d3ee', opacity: '0.18' },
      { offset: '40%', color: '#a78bfa', opacity: '0.10' },
      { offset: '80%', color: '#22d3ee', opacity: '0.04' },
      { offset: '100%', color: '#22d3ee', opacity: '0' },
    ],
    stroke: 'rgba(140, 200, 255, 0.18)',
    textFill: 'rgba(180, 220, 255, 0.06)',
  },
  shopping: {
    padX: 110,
    padY: 115,
    stops: [
      { offset: '0%', color: '#22d3ee', opacity: '0.14' },
      { offset: '35%', color: '#34d399', opacity: '0.08' },
      { offset: '75%', color: '#22d3ee', opacity: '0.04' },
      { offset: '100%', color: '#22d3ee', opacity: '0' },
    ],
    stroke: 'rgba(52, 211, 153, 0.16)',
    textFill: 'rgba(52, 211, 153, 0.065)',
  },
  fulfillment: {
    padX: 100,
    padY: 120,
    stops: [
      { offset: '0%', color: '#f5b731', opacity: '0.16' },
      { offset: '35%', color: '#fb923c', opacity: '0.10' },
      { offset: '75%', color: '#f5b731', opacity: '0.04' },
      { offset: '100%', color: '#f5b731', opacity: '0' },
    ],
    stroke: 'rgba(245, 183, 49, 0.18)',
    textFill: 'rgba(251, 180, 80, 0.07)',
  },
  engagement: {
    padX: 90,
    padY: 90,
    stops: [
      { offset: '0%', color: '#e879f9', opacity: '0.15' },
      { offset: '35%', color: '#ec4899', opacity: '0.08' },
      { offset: '75%', color: '#e879f9', opacity: '0.04' },
      { offset: '100%', color: '#e879f9', opacity: '0' },
    ],
    stroke: 'rgba(232, 121, 249, 0.16)',
    textFill: 'rgba(232, 121, 249, 0.065)',
  },
};

function hexToRgba(hex: string, alpha: number): string {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgba(${channels.join(', ')}, ${alpha})`;
}

function styleFor(cluster: Cluster): ClusterStyle {
  const known = CLUSTER_STYLES[cluster.id];
  if (known) return known;
  const base = PALETTE[cluster.nebula.base];
  const hot = PALETTE[cluster.nebula.hot];
  return {
    padX: 100,
    padY: 100,
    stops: [
      { offset: '0%', color: base, opacity: '0.14' },
      { offset: '35%', color: hot, opacity: '0.08' },
      { offset: '75%', color: base, opacity: '0.04' },
      { offset: '100%', color: base, opacity: '0' },
    ],
    stroke: hexToRgba(base, 0.16),
    textFill: hexToRgba(base, 0.065),
  };
}

interface ClusterBackdropProps {
  cluster: Cluster;
  servicesById: Record<string, Service>;
  activeNodes?: Set<string> | null;
}

/**
 * Soft "milky way" backdrop grouping a cluster's services, with a hairline
 * boundary and a big watermark label. Pure decoration — pointer-events
 * disabled, lives in the world transform group so it pans/zooms with the map.
 */
export function ClusterBackdrop({ cluster, servicesById, activeNodes = null }: ClusterBackdropProps) {
  const nodes = cluster.serviceIds.map((id) => servicesById[id]).filter(Boolean);
  const isActive = activeNodes === null;
  if (nodes.length === 0) return null;

  const style = styleFor(cluster);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2);
    minY = Math.min(minY, n.y - n.height / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = (maxX - minX) / 2 + style.padX;
  const ry = (maxY - minY) / 2 + style.padY;
  const label = cluster.label.toUpperCase();
  const gradientId = `cosmos-${cluster.id}-cluster`;

  return (
    <g
      pointerEvents="none"
      aria-hidden="true"
      data-cluster-id={cluster.id}
      style={{ opacity: isActive ? 1 : 0.08, filter: isActive ? undefined : 'blur(1.6px) saturate(0.35)', transition: 'opacity 520ms cubic-bezier(0.2,0.9,0.3,1.1), filter 520ms cubic-bezier(0.2,0.9,0.3,1.1)' }}
    >
      <defs>
        <radialGradient id={gradientId} cx="0.5" cy="0.5" r="0.55">
          {style.stops.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
          ))}
        </radialGradient>
      </defs>

      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${gradientId})`} />

      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={style.stroke}
        strokeWidth={1}
        strokeDasharray="2 6"
      />

      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Orbitron, var(--font-display)"
        fontSize={Math.min(ry * 0.55, (rx * 1.7) / label.length)}
        fontWeight={600}
        fill={style.textFill}
        letterSpacing="0.22em"
      >
        {label}
      </text>
    </g>
  );
}
