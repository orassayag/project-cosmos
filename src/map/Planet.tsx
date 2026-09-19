import type { MouseEvent, ReactNode } from 'react';

import type { Service } from '../scenarios/types';
import { hashId, makeRng, planetHasRing, planetRadius, planetType } from './planetMorphology';

// Relative-color helpers: shift a service's own hue lighter/darker so a
// world's surface reads as one material in its identity colour.
const lighten = (hex: string, dl: number, chroma = 1) =>
  `oklch(from ${hex} calc(l + ${dl}) calc(c * ${chroma}) h)`;
const darken = (hex: string, dl: number, chroma = 1) =>
  `oklch(from ${hex} calc(l - ${dl}) calc(c * ${chroma}) h)`;

/** Irregular closed blob (continent / lava field) around a centre. */
function blobPath(cx: number, cy: number, r: number, points: number, rng: () => number): string {
  let path = '';
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const radius = r * (0.55 + rng() * 0.6);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    path += `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return `${path}Z`;
}

/** The clipped surface features that make each world distinct. */
function Surface({ service: n, radius, rng }: { service: Service; radius: number; rng: () => number }): ReactNode {
  const type = planetType(n.id);
  const R = radius;

  if (type === 'terran') {
    const continents = 3 + Math.floor(rng() * 2);
    return (
      <>
        {Array.from({ length: continents }).map((_, index) => {
          const cx = (rng() - 0.5) * R * 1.2;
          const cy = (rng() - 0.5) * R * 1.2;
          return (
            <path
              key={index}
              d={blobPath(cx, cy, R * (0.3 + rng() * 0.25), 7, rng)}
              fill={lighten(n.hex, 0.16, 1.2)}
              opacity={0.85}
            />
          );
        })}
        <ellipse cx={0} cy={-R * 0.92} rx={R * 0.7} ry={R * 0.32} fill="#ffffff" opacity={0.8} />
        <ellipse cx={0} cy={R * 0.92} rx={R * 0.6} ry={R * 0.28} fill="#ffffff" opacity={0.7} />
      </>
    );
  }

  if (type === 'cratered') {
    const craters = 8 + Math.floor(rng() * 4);
    return (
      <>
        <circle cx={0} cy={0} r={R} fill={darken(n.hex, 0, 0.35)} opacity={0.4} />
        {Array.from({ length: craters }).map((_, index) => {
          const cx = (rng() - 0.5) * R * 1.6;
          const cy = (rng() - 0.5) * R * 1.6;
          const cr = R * (0.08 + rng() * 0.18);
          return (
            <g key={index}>
              <circle cx={cx} cy={cy} r={cr} fill={darken(n.hex, 0.14)} opacity={0.7} />
              <circle cx={cx - cr * 0.2} cy={cy - cr * 0.2} r={cr} fill="none" stroke={lighten(n.hex, 0.18)} strokeWidth={0.8} strokeOpacity={0.5} />
            </g>
          );
        })}
      </>
    );
  }

  if (type === 'banded' || type === 'ringed') {
    const bands = 6;
    return (
      <>
        {Array.from({ length: bands }).map((_, index) => {
          const t = index / (bands - 1);
          const y = -R + t * 2 * R;
          const light = index % 2 === 0;
          return (
            <ellipse
              key={index}
              cx={0}
              cy={y}
              rx={R * 1.1}
              ry={R * 0.16}
              fill={light ? lighten(n.hex, 0.12) : darken(n.hex, 0.12)}
              opacity={0.55}
            />
          );
        })}
        <ellipse cx={R * 0.32} cy={R * 0.28} rx={R * 0.26} ry={R * 0.16} fill={darken(n.hex, 0.2, 1.2)} opacity={0.8} />
      </>
    );
  }

  if (type === 'icy') {
    return (
      <>
        <circle cx={0} cy={0} r={R} fill="#ffffff" opacity={0.16} />
        {Array.from({ length: 3 }).map((_, index) => (
          <ellipse
            key={`patch-${index}`}
            cx={(rng() - 0.5) * R}
            cy={(rng() - 0.5) * R}
            rx={R * (0.2 + rng() * 0.2)}
            ry={R * (0.14 + rng() * 0.14)}
            fill={lighten(n.hex, 0.22, 0.6)}
            opacity={0.5}
          />
        ))}
        {Array.from({ length: 4 }).map((_, index) => {
          const x1 = (rng() - 0.5) * R * 1.6;
          const y1 = (rng() - 0.5) * R * 1.6;
          return (
            <line
              key={`crack-${index}`}
              x1={x1}
              y1={y1}
              x2={x1 + (rng() - 0.5) * R}
              y2={y1 + (rng() - 0.5) * R}
              stroke={lighten(n.hex, 0.28)}
              strokeWidth={1}
              strokeOpacity={0.55}
            />
          );
        })}
      </>
    );
  }

  // volcanic
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <path
          key={`crust-${index}`}
          d={blobPath((rng() - 0.5) * R * 1.1, (rng() - 0.5) * R * 1.1, R * (0.3 + rng() * 0.25), 6, rng)}
          fill={darken(n.hex, 0.22)}
          opacity={0.75}
        />
      ))}
      {Array.from({ length: 3 }).map((_, index) => {
        const x1 = (rng() - 0.5) * R * 1.4;
        const y1 = (rng() - 0.5) * R * 1.4;
        return (
          <line
            key={`lava-${index}`}
            x1={x1}
            y1={y1}
            x2={x1 + (rng() - 0.5) * R * 0.9}
            y2={y1 + (rng() - 0.5) * R * 0.9}
            stroke={lighten(n.hex, 0.4, 1.3)}
            strokeWidth={1.4}
            strokeOpacity={0.9}
            style={{ filter: 'url(#cosmos-packet-glow)' }}
          />
        );
      })}
    </>
  );
}

interface PlanetProps {
  service: Service;
  onClick: (event: MouseEvent) => void;
}

/**
 * A service rendered as a shaded celestial body: an atmosphere halo, a
 * lit sphere with a type-specific surface, a terminator shadow, a rim
 * highlight, and — for ringed worlds — a tilted ring whose near arc
 * crosses in front of the disc. Only the sphere is a click target; the
 * title is drawn separately by the caller so it stays legible.
 */
export function Planet({ service: n, onClick }: PlanetProps) {
  const R = planetRadius(n.id);
  const type = planetType(n.id);
  const hasRing = planetHasRing(n.id);
  const rng = makeRng(hashId(n.id));

  const ringTilt = -20 - (hashId(n.id) % 12);
  const ringRx = R * 1.7;
  const ringRy = R * 0.5;

  const atmoOpacity = type === 'terran' || type === 'icy' ? 0.55 : type === 'volcanic' || type === 'cratered' ? 0.3 : 0.42;
  const atmoReach = type === 'terran' || type === 'icy' ? 13 : 8;

  return (
    <g>
      <defs>
        <radialGradient id={`planet-sphere-${n.id}`} cx="0.35" cy="0.3" r="0.78">
          <stop offset="0%" stopColor={lighten(n.hex, 0.3, 0.6)} />
          <stop offset="48%" stopColor={n.hex} />
          <stop offset="100%" stopColor={darken(n.hex, 0.32)} />
        </radialGradient>
        <radialGradient id={`planet-shadow-${n.id}`} cx="0.68" cy="0.72" r="0.75">
          <stop offset="55%" stopColor="#000000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.5} />
        </radialGradient>
        <clipPath id={`planet-clip-${n.id}`}>
          <circle cx={0} cy={0} r={R} />
        </clipPath>
      </defs>

      {/* Atmosphere halo. */}
      <circle cx={0} cy={0} r={R + atmoReach} fill={`url(#cosmos-star-${n.id})`} opacity={atmoOpacity} pointerEvents="none" />

      {/* Ring — far arc behind the disc. */}
      {hasRing && (
        <g transform={`rotate(${ringTilt})`} pointerEvents="none">
          <ellipse cx={0} cy={0} rx={ringRx} ry={ringRy} fill="none" stroke={lighten(n.hex, 0.14)} strokeOpacity={0.7} strokeWidth={2.6} />
          <ellipse cx={0} cy={0} rx={ringRx + 8} ry={ringRy + 4} fill="none" stroke={lighten(n.hex, 0.1)} strokeOpacity={0.3} strokeWidth={1.2} />
        </g>
      )}

      {/* Sphere body — the click target. */}
      <circle
        cx={0}
        cy={0}
        r={R}
        fill={`url(#planet-sphere-${n.id})`}
        onClick={onClick}
        style={{ cursor: 'pointer' }}
      />

      {/* Surface + terminator, clipped to the disc. */}
      <g clipPath={`url(#planet-clip-${n.id})`} pointerEvents="none">
        <Surface service={n} radius={R} rng={rng} />
        <circle cx={0} cy={0} r={R} fill={`url(#planet-shadow-${n.id})`} />
      </g>

      {/* Specular highlight + rim light. */}
      <ellipse cx={-R * 0.34} cy={-R * 0.36} rx={R * 0.3} ry={R * 0.2} fill="#ffffff" opacity={0.35} pointerEvents="none" />
      <circle cx={0} cy={0} r={R} fill="none" stroke={lighten(n.hex, 0.22)} strokeOpacity={0.4} strokeWidth={1} pointerEvents="none" />

      {/* Ring — near arc in front of the disc. */}
      {hasRing && (
        <g transform={`rotate(${ringTilt})`} pointerEvents="none">
          <path d={`M ${-ringRx} 0 A ${ringRx} ${ringRy} 0 0 1 ${ringRx} 0`} fill="none" stroke={lighten(n.hex, 0.18)} strokeOpacity={0.75} strokeWidth={2.6} />
        </g>
      )}
    </g>
  );
}
