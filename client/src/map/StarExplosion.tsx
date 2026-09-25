import { motion } from 'framer-motion';

interface StarExplosionProps {
  /** World-space centre of the star that blew up. */
  x: number;
  y: number;
  /** The star's own color — half the debris keeps its hue. */
  color: string;
}

interface Shard {
  angle: number;
  distance: number;
  width: number;
  height: number;
  spin: number;
}

/** Deterministic debris field — precomputed so the burst looks the same each
 *  time and never re-randomises on re-render. */
const SHARDS: Shard[] = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + (i % 3) * 0.4;
  return {
    angle,
    distance: 46 + ((i * 37) % 78),
    width: 5 + ((i * 13) % 9),
    height: 3 + ((i * 7) % 6),
    spin: ((i * 57) % 220) - 110,
  };
});

/**
 * A star detonating on the map: a single white flash, then the capsule's
 * remains flung outward as shards that settle into scattered debris (they end
 * dim rather than vanishing, so the wreck stays where the star used to be).
 * The blown-up capsule itself is removed by the map, so only the pieces show.
 */
export function StarExplosion({ x, y, color }: StarExplosionProps) {
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none" className="lc-star-explosion">
      <motion.circle
        cx={0}
        cy={0}
        r={10}
        fill="#fff5f3"
        initial={{ opacity: 0.95, scale: 0.4 }}
        animate={{ opacity: 0, scale: 5 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {SHARDS.map((shard, i) => (
        <motion.g
          key={i}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
          animate={{
            x: Math.cos(shard.angle) * shard.distance,
            y: Math.sin(shard.angle) * shard.distance,
            rotate: shard.spin,
            opacity: [0, 1, 0.82],
          }}
          transition={{ duration: 0.75, ease: [0.12, 0.8, 0.3, 1], delay: 0.02 + i * 0.012 }}
        >
          <rect
            x={-shard.width / 2}
            y={-shard.height / 2}
            width={shard.width}
            height={shard.height}
            rx={1}
            fill={i % 2 === 0 ? color : '#ffd9d5'}
            opacity={0.9}
          />
        </motion.g>
      ))}
    </g>
  );
}
