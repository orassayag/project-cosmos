import type { Topic } from '../scenarios/types';
import type { DriftKind } from '../scenarios/drift';
import { DRIFT_KIND_META } from '../scenarios/drift';

interface TopicNodeProps {
  topic: Topic;
  selected?: boolean;
  dimmed?: boolean;
  /** True when the map is zoomed in enough to show labels without clutter. */
  showLabel?: boolean;
  /** When set, the topic was touched by the latest drift run — glows in the kind's color. */
  driftKind?: DriftKind | null;
  /** Generic halo color for the blast-radius overlay (a hex, or null). */
  accentRing?: string | null;
  onClick: (id: string) => void;
}

/**
 * Topic node — small dashed orbital ring with a tiny core.
 * Slowly rotates always (kept lightweight). Visual values lifted
 */
export function TopicNode({ topic: t, selected = false, dimmed = false, showLabel = false, driftKind = null, accentRing = null, onClick }: TopicNodeProps) {
  // Topics below the main spine pile labels downward — flip above so they stay readable.
  const labelAbove =
    t.labelSide === 'above' ? true
    : t.labelSide === 'below' ? false
    : t.y >= 510;
  const labelY1 = labelAbove ? -20 : 30;

  return (
    <g
      transform={`translate(${t.x},${t.y})`}
      data-no-pan="true"
      data-dimmed={dimmed ? 'true' : 'false'}
      className="lc-topic-node"
      onClick={(e) => { e.stopPropagation(); onClick(t.id); }}
    >
      {/* outer aura */}
      <circle r={22} fill={`url(#cosmos-star-${t.id})`} opacity={0.5} />

      {/* dashed orbital ring */}
      <circle r={11} fill="none" stroke={t.color} strokeOpacity={0.85} strokeWidth={1} strokeDasharray="3 2.5">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="14s" repeatCount="indefinite" />
      </circle>

      {/* core */}
      <circle r={2.5} fill={t.color} />

      {driftKind && (
        <circle
          r={17}
          fill="none"
          stroke={DRIFT_KIND_META[driftKind].color}
          strokeWidth={2}
          pointerEvents="none"
          style={{ filter: 'url(#cosmos-packet-glow)' }}
        >
          <animate attributeName="stroke-opacity" values="0.9;0.3;0.9" dur="1.8s" repeatCount="indefinite" />
        </circle>
      )}

      {accentRing && (
        <circle
          r={17}
          fill="none"
          stroke={accentRing}
          strokeWidth={2}
          pointerEvents="none"
          style={{ filter: 'url(#cosmos-packet-glow)' }}
        >
          <animate attributeName="stroke-opacity" values="0.95;0.35;0.95" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {selected && (
        <circle r={14} fill="none" stroke={t.color} strokeWidth={1} strokeOpacity={0.9} />
      )}

      {/* label — fades in while selected (click or active shot), on the active
          scenario path, or when zoomed into this topic's viewport region. */}
      <g
        style={{
          opacity: selected || showLabel ? 1 : 0,
          transition: 'opacity 320ms ease',
          pointerEvents: 'none',
        }}
      >
          <text
            y={labelY1}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={13}
            fontWeight={600}
            fill={t.color}
            fillOpacity={0.95}
            stroke="var(--bg-app)"
            strokeWidth={3}
            strokeLinejoin="round"
            paintOrder="stroke"
            letterSpacing="0.16em"
          >
            {t.name.toUpperCase()}
          </text>
      </g>
    </g>
  );
}
