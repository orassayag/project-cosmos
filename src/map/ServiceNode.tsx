import { AnimatePresence, motion } from 'framer-motion';

import type { Service, SubService } from '../scenarios/types';
import type { DriftKind } from '../scenarios/drift';
import { DRIFT_KIND_META } from '../scenarios/drift';
import { Planet } from './Planet';
import { planetRadius } from './planetMorphology';

interface ServiceNodeProps {
  service: Service;
  selected?: boolean;
  dimmed?: boolean;
  expanded?: boolean;
  /** When set, the node was touched by the latest drift run — glows in the kind's color. */
  driftKind?: DriftKind | null;
  /** Generic halo color for the blast-radius / health overlays (a hex, or null). */
  accentRing?: string | null;
  /** When this service's ecosystem is expanded, which sub is currently selected. */
  selectedSubId?: string | null;
  /**
   * If non-null, only sub-services with ids in this set are "active" (in
   * the active scenario's path). The rest get dimmed inside the orbit
   * the same way unrelated services dim on the main map.
   */
  activeSubs?: Set<string> | null;
  /** Count of Kafka topics folded into this card (shown as a badge while
      the topic ring is collapsed). */
  topicCount?: number | null;
  onClick: (id: string) => void;
  onSubServiceClick?: (serviceId: string, subId: string) => void;
}

export function ServiceNode({
  service: n,
  selected = false,
  dimmed = false,
  expanded = false,
  driftKind = null,
  accentRing = null,
  selectedSubId = null,
  activeSubs = null,
  topicCount = null,
  onClick,
  onSubServiceClick,
}: ServiceNodeProps) {
  const hasEcosystem = !!(n.subServices && n.subServices.length > 0);
  const r = planetRadius(n.id);
  const labelY = r + 30;

  return (
    <g
      transform={`translate(${n.x},${n.y})`}
      data-no-pan="true"
      data-dimmed={dimmed ? 'true' : 'false'}
      className="lc-service-node"
    >
      {/* Parent capsule — animates in/out as the ecosystem opens/closes. */}
      <AnimatePresence>
        {!expanded && (
          <motion.g
            key="parent-capsule"
            initial={{ opacity: 0, scale: 0.55 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.45 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24, mass: 0.6 }}
          >
            {driftKind && (
              <circle
                cx={0}
                cy={0}
                r={r + 7}
                fill="none"
                stroke={DRIFT_KIND_META[driftKind].color}
                strokeWidth={2.4}
                pointerEvents="none"
                style={{ filter: 'url(#cosmos-packet-glow)' }}
              >
                <animate attributeName="stroke-opacity" values="0.9;0.35;0.9" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}

            {accentRing && (
              <circle
                cx={0}
                cy={0}
                r={r + 7}
                fill="none"
                stroke={accentRing}
                strokeWidth={2.4}
                pointerEvents="none"
                style={{ filter: 'url(#cosmos-packet-glow)' }}
              >
                <animate attributeName="stroke-opacity" values="0.95;0.4;0.95" dur="2s" repeatCount="indefinite" />
              </circle>
            )}

            {selected && (
              <circle
                cx={0}
                cy={0}
                r={r + 4}
                fill="none"
                stroke={n.color}
                strokeWidth={1.25}
                strokeOpacity={0.95}
                pointerEvents="none"
              >
                <animate attributeName="stroke-opacity" values="0.95;0.4;0.95" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}

            {/* The world itself. */}
            <Planet service={n} onClick={(e) => { e.stopPropagation(); onClick(n.id); }} />

            {/* Title — sits below the sphere with a stroke halo so the
                name stays legible over the map behind it. */}
            <text
              x={0}
              y={labelY}
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontSize={27}
              fontWeight={600}
              fill="var(--text-1)"
              stroke="var(--bg-app)"
              strokeWidth={4.5}
              strokeLinejoin="round"
              letterSpacing="-0.014em"
              paintOrder="stroke"
              pointerEvents="none"
            >
              {n.name}
            </text>

            {/* Kafka-topics indicator — a tiny orbital badge on the disc
                edge. Zooming in fans the topics out around the world. */}
            {topicCount != null && topicCount > 0 && (
              <g transform={`translate(${r * 0.72}, ${-r * 0.72})`} pointerEvents="none">
                <circle r={10} fill="oklch(from var(--bg-surface) l c h / 0.95)" stroke="var(--svc-orange)" strokeOpacity={0.9} strokeWidth={1} strokeDasharray="3 2.5" />
                <text
                  y={3}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize={8.5}
                  fontWeight={600}
                  fill="var(--svc-orange)"
                >
                  {topicCount}
                </text>
              </g>
            )}
          </motion.g>
        )}
      </AnimatePresence>

      {/* Solar-system layer — animates in when expanded. */}
      <AnimatePresence>
        {expanded && hasEcosystem && (
          <Ecosystem
            parent={n}
            subs={n.subServices!}
            selectedSubId={selectedSubId}
            activeSubs={activeSubs}
            onSubClick={(subId) => onSubServiceClick?.(n.id, subId)}
          />
        )}
      </AnimatePresence>

    </g>
  );
}


interface EcosystemProps {
  parent: Service;
  subs: SubService[];
  selectedSubId: string | null;
  activeSubs: Set<string> | null;
  onSubClick: (subId: string) => void;
}

/**
 * The expanded solar system. Diagonal slots NE / SE / SW / NW so the
 * cluster doesn't collide with east-side topics or west-side neighbours.
 *
 * Animation:
 *   • Expand — orbit ring scales in; sub-capsules SPRING out from
 *     center to their slots, staggered; an outward shockwave ring
 *     blooms once and dissipates.
 *   • Collapse — exact reverse. Subs spring BACK to center, ring
 *     contracts, an inward implosion ring sweeps in.
 */
function Ecosystem({ parent, subs, selectedSubId, activeSubs, onSubClick }: EcosystemProps) {
  const radius = 95;
  const subW = 110;
  const subH = 36;
  const slot = (i: number) => {
    const a = (i / subs.length) * Math.PI * 2 - Math.PI / 4;
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
  };

  return (
    <motion.g
      key="ecosystem"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0.9, 0.3, 1.1] }}
      pointerEvents="none"
    >
      {/* OUTWARD shockwave — fires on mount (expand). */}
      <motion.circle
        cx={0} cy={0}
        fill="none"
        stroke={parent.color}
        strokeWidth={1.6}
        initial={{ r: 6, opacity: 0.85, strokeWidth: 2.4 }}
        animate={{ r: radius * 2.2, opacity: 0, strokeWidth: 0.4 }}
        transition={{ duration: 0.7, ease: [0.2, 0.7, 0.4, 1] }}
        pointerEvents="none"
      />

      {/* INWARD implosion — fires on unmount (collapse). */}
      <motion.circle
        cx={0} cy={0}
        fill="none"
        stroke={parent.color}
        strokeWidth={0.4}
        initial={{ r: radius * 2.2, opacity: 0 }}
        animate={{ r: radius * 2.2, opacity: 0 }}
        exit={{ r: 6, opacity: 0.85, strokeWidth: 2.4 }}
        transition={{ duration: 0.55, ease: [0.55, 0, 0.78, 0.2] }}
        pointerEvents="none"
      />

      {/* Faint orbit ring. */}
      <motion.circle
        cx={0}
        cy={0}
        r={radius}
        fill="none"
        stroke={parent.color}
        strokeOpacity={0.2}
        strokeWidth={0.8}
        strokeDasharray="3 5"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.2 }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22, mass: 0.5 }}
      />

      {subs.map((sub, i) => {
        const pos = slot(i);
        const isSelected = sub.id === selectedSubId;
        const isDimmed = activeSubs ? !activeSubs.has(sub.id) : false;
        return (
          <motion.g
            key={sub.id}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.35 }}
            animate={{ x: pos.x, y: pos.y, opacity: 1, scale: 1 }}
            exit={{ x: 0, y: 0, opacity: 0, scale: 0.35 }}
            transition={{
              type: 'spring',
              stiffness: 240,
              damping: 18,
              mass: 0.55,
              delay: 0.04 + i * 0.06,
            }}
            data-dimmed={isDimmed ? 'true' : 'false'}
            className="lc-sub-service-node"
          >
            {/* Faint tether back to parent center. */}
            <line
              x1={0} y1={0}
              x2={-pos.x} y2={-pos.y}
              stroke={parent.color}
              strokeOpacity={0.16}
              strokeWidth={0.8}
              strokeDasharray="2 4"
              pointerEvents="none"
            />

            <ellipse
              cx={0} cy={0}
              rx={subW / 2 + 8}
              ry={subH / 2 + 8}
              fill={`url(#cosmos-star-${parent.id})`}
              opacity={0.45}
              pointerEvents="none"
            />

            {isSelected && (
              <rect
                x={-subW / 2 - 3}
                y={-subH / 2 - 3}
                width={subW + 6}
                height={subH + 6}
                rx={(subH + 6) / 2}
                fill="none"
                stroke={parent.color}
                strokeWidth={1.1}
                strokeOpacity={0.95}
                pointerEvents="none"
              >
                <animate attributeName="stroke-opacity" values="0.95;0.4;0.95" dur="2.4s" repeatCount="indefinite" />
              </rect>
            )}

            <rect
              x={-subW / 2}
              y={-subH / 2}
              width={subW}
              height={subH}
              rx={subH / 2}
              fill="oklch(from var(--bg-surface) l c h / 0.96)"
              stroke={parent.color}
              strokeOpacity={0.8}
              strokeWidth={1.2}
              pointerEvents="auto"
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onSubClick(sub.id); }}
            />

            <text
              x={0}
              y={5}
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontSize={12}
              fontWeight={500}
              fill="var(--text-1)"
              letterSpacing="-0.012em"
              pointerEvents="none"
            >
              {sub.name}
            </text>
          </motion.g>
        );
      })}
    </motion.g>
  );
}
