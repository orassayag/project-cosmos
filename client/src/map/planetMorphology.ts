// ── Planet morphology ──────────────────────────────────────────
// Every service is a distinct world, not an identical capsule. The
// service's hue stays its identity (the `hex`/`color` invariant), but
// its *surface* varies: terran continents, a cratered moon, gas-giant
// bands, an icy shell, a volcanic crust, or a ringed world. Type, size,
// and every surface feature are derived deterministically from the
// service id, so a world looks the same on every render and neighbours
// differ. Both the renderer (`Planet.tsx`) and the edge geometry
// (`edge-builder.ts`) read `planetRadius` from here so edges always
// touch the visible sphere.

export type PlanetType = 'terran' | 'cratered' | 'banded' | 'icy' | 'volcanic' | 'ringed';

const PLANET_TYPES: PlanetType[] = ['terran', 'cratered', 'banded', 'icy', 'volcanic', 'ringed'];

/** Body radius (where edges attach) per type, relative to the base. */
const SIZE_SCALE: Record<PlanetType, number> = {
  terran: 1.0,
  cratered: 0.78,
  banded: 1.18,
  icy: 0.9,
  volcanic: 0.94,
  ringed: 1.12,
};

const BASE_RADIUS = 42;

/** Stable, non-negative hash of a string. */
export function hashId(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Seeded PRNG (mulberry32) → deterministic surface features per world. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function planetType(id: string): PlanetType {
  return PLANET_TYPES[hashId(id) % PLANET_TYPES.length];
}

/** Radius of the visible sphere body — the edge attachment radius. */
export function planetRadius(id: string): number {
  return Math.round(BASE_RADIUS * SIZE_SCALE[planetType(id)]);
}

/** A world has a tilted ring? */
export function planetHasRing(id: string): boolean {
  const type = planetType(id);
  if (type === 'ringed') return true;
  // A few banded gas-giants also get a ring, chosen deterministically.
  return type === 'banded' && hashId(id) % 3 === 0;
}
