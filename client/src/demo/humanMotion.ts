/**
 * Makes the demo's pointer and typing read as a person's: curved, shaky, unevenly paced moves that
 * sometimes wander off first, land off-centre and sometimes overshoot, and a typing rhythm that
 * stumbles. Every "random" choice is seeded, so a given move or phrase always plays the same way
 * (recordings and tests stay stable).
 */

export interface Point {
  x: number;
  y: number;
}

export interface TargetRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Seeded uniform numbers in [0, 1) (mulberry32). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function seedFromText(text: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619);
  return hash >>> 0;
}

function between(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}

/** Where on the target a person's click lands: near the middle, never dead centre, never the edge. */
export function landingOffset(random: () => number): Point {
  return { x: between(random, -0.22, 0.22), y: between(random, -0.18, 0.18) };
}

export function landingPoint(rect: TargetRect, offset: Point): Point {
  return {
    x: rect.left + rect.width * (0.5 + offset.x),
    y: rect.top + rect.height * (0.5 + offset.y),
  };
}

/** Minimum-jerk profile: the speed curve of a relaxed hand — slow start, fast middle, slow end. */
function minimumJerk(progress: number): number {
  return progress * progress * progress * (10 - 15 * progress + 6 * progress * progress);
}

function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

export interface PointerPath {
  durationMs: number;
  /** Position at `progress` in [0, 1]; exactly `to` at 1. */
  at: (progress: number) => Point;
}

/** Share of the move spent on the final correction after an overshoot. */
const CORRECTION_SHARE = 0.18;

interface PathLeg {
  from: Point;
  to: Point;
  control1: Point;
  control2: Point;
  share: number;
}

function bowedLeg(from: Point, to: Point, random: () => number): Omit<PathLeg, 'share'> {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const normalX = -deltaY / length;
  const normalY = deltaX / length;
  const bow = length * between(random, 0.06, 0.2) * (random() < 0.5 ? -1 : 1);
  return {
    from,
    to,
    control1: { x: from.x + deltaX * 0.3 + normalX * bow, y: from.y + deltaY * 0.3 + normalY * bow },
    control2: { x: from.x + deltaX * 0.75 + normalX * bow * 0.45, y: from.y + deltaY * 0.75 + normalY * bow * 0.45 },
  };
}

/** A point off the straight line in a random direction: the hand drifts toward the wrong spot first. */
function detourPoint(from: Point, to: Point, distance: number, random: () => number): Point {
  const along = between(random, 0.25, 0.6);
  const angle = random() * Math.PI * 2;
  const reach = distance * between(random, 0.12, 0.3);
  return {
    x: from.x + (to.x - from.x) * along + Math.cos(angle) * reach,
    y: from.y + (to.y - from.y) * along + Math.sin(angle) * reach,
  };
}

/** Hand shake: a slow drift plus a few sharp jitter bursts, fading to nothing at both ends. */
function planShake(random: () => number): (progress: number) => Point {
  const waves = Array.from({ length: 3 }, () => ({
    frequency: between(random, 9, 31),
    phaseX: random() * Math.PI * 2,
    phaseY: random() * Math.PI * 2,
    amplitude: between(random, 0.5, 1.6),
  }));
  const bursts = Array.from({ length: random() < 0.7 ? 1 + Math.floor(random() * 2) : 0 }, () => ({
    center: between(random, 0.15, 0.8),
    width: between(random, 0.05, 0.12),
    amplitude: between(random, 1.5, 3.5),
    phase: random() * Math.PI * 2,
  }));
  return (progress) => {
    const envelope = Math.sin(progress * Math.PI);
    let x = 0;
    let y = 0;
    for (const wave of waves) {
      x += wave.amplitude * Math.sin(progress * wave.frequency + wave.phaseX);
      y += wave.amplitude * Math.sin(progress * wave.frequency * 1.3 + wave.phaseY);
    }
    for (const burst of bursts) {
      const strength = Math.max(0, 1 - Math.abs(progress - burst.center) / burst.width);
      x += burst.amplitude * strength * Math.sin(progress * 180 + burst.phase);
      y += burst.amplitude * strength * Math.cos(progress * 150 + burst.phase);
    }
    return { x: x * envelope, y: y * envelope };
  };
}

/**
 * A human-looking move from `from` to `to` that fits within `maxDurationMs` at speed 1. Longer
 * moves take longer (Fitts's law), each leg bows to one side, the hand sometimes wanders off in a
 * random direction before heading for the target, shakes on the way, and may overshoot then settle.
 */
export function planPointerPath(from: Point, to: Point, random: () => number, maxDurationMs: number): PointerPath {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < 2) return { durationMs: Math.max(0, Math.min(maxDurationMs, 170 + between(random, -30, 40))), at: () => to };

  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  const overshoot = distance > 80 && random() < 0.6 ? Math.min(14, distance * between(random, 0.02, 0.05)) : 0;
  const end = { x: to.x + unitX * overshoot, y: to.y + unitY * overshoot };
  const waypoints = distance > 60 && random() < 0.5 ? [from, detourPoint(from, to, distance, random), end] : [from, end];

  const legShapes = waypoints.slice(1).map((waypoint, index) => bowedLeg(waypoints[index], waypoint, random));
  const legLengths = legShapes.map((leg) => Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y));
  const pathLength = legLengths.reduce((total, length) => total + length, 0);
  const legs: PathLeg[] = legShapes.map((leg, index) => ({ ...leg, share: legLengths[index] / pathLength }));
  const durationMs = Math.min(maxDurationMs, 170 + 95 * Math.log2(1 + pathLength / 18) + between(random, -30, 40));
  const shake = planShake(random);
  const mainShare = overshoot > 0 ? 1 - CORRECTION_SHARE : 1;

  const onLegs = (along: number): Point => {
    let legStart = 0;
    for (const leg of legs) {
      if (along <= legStart + leg.share || leg === legs[legs.length - 1]) {
        const legProgress = Math.min(1, (along - legStart) / leg.share);
        return cubicBezier(leg.from, leg.control1, leg.control2, leg.to, minimumJerk(legProgress));
      }
      legStart += leg.share;
    }
    return end;
  };

  const at = (progress: number): Point => {
    const clamped = Math.min(1, Math.max(0, progress));
    if (clamped >= 1) return to;
    const jitter = shake(clamped);
    if (clamped > mainShare) {
      const settle = minimumJerk((clamped - mainShare) / CORRECTION_SHARE);
      return { x: end.x + (to.x - end.x) * settle + jitter.x, y: end.y + (to.y - end.y) * settle + jitter.y };
    }
    const point = onLegs(clamped / mainShare);
    return { x: point.x + jitter.x, y: point.y + jitter.y };
  };
  return { durationMs, at };
}

/**
 * Pause after typing each character, at speed 1. Averages about the old fixed 55ms, but bursts
 * through common letters, slows at word breaks and punctuation, and hesitates now and then.
 */
export function typingDelaysMs(text: string): number[] {
  const random = createRandom(seedFromText(text));
  return [...text].map((character, index) => {
    let delayMs = between(random, 32, 72);
    if (character === ' ') delayMs += between(random, 20, 70);
    if (/[,.?!]/.test(character)) delayMs += between(random, 60, 140);
    if (/[A-Z0-9]/.test(character)) delayMs += between(random, 15, 45);
    if (index > 0 && random() < 0.06) delayMs += between(random, 120, 260);
    return Math.round(delayMs);
  });
}

export function typingDurationMs(text: string): number {
  return typingDelaysMs(text).reduce((totalMs, delayMs) => totalMs + delayMs, 0);
}
