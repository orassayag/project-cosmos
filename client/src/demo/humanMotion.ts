/**
 * Makes the demo's pointer and typing read as a person's: curved, unevenly paced moves that land
 * off-centre and sometimes overshoot, and a typing rhythm that stumbles. Every "random" choice is
 * seeded, so a given move or phrase always plays the same way (recordings and tests stay stable).
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

/**
 * A human-looking move from `from` to `to` that fits within `maxDurationMs` at speed 1. Longer
 * moves take longer (Fitts's law), the path bows to one side, and it may overshoot then settle.
 */
export function planPointerPath(from: Point, to: Point, random: () => number, maxDurationMs: number): PointerPath {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);
  const durationMs = Math.min(maxDurationMs, 170 + 95 * Math.log2(1 + distance / 18) + between(random, -30, 40));
  if (distance < 2) return { durationMs: Math.max(0, durationMs), at: () => to };

  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  const side = random() < 0.5 ? -1 : 1;
  const bow = distance * between(random, 0.06, 0.2) * side;
  const overshoot = distance > 80 && random() < 0.6 ? Math.min(14, distance * between(random, 0.02, 0.05)) : 0;
  const end = { x: to.x + unitX * overshoot, y: to.y + unitY * overshoot };
  const control1 = { x: from.x + deltaX * 0.3 - unitY * bow, y: from.y + deltaY * 0.3 + unitX * bow };
  const control2 = { x: from.x + deltaX * 0.75 - unitY * bow * 0.45, y: from.y + deltaY * 0.75 + unitX * bow * 0.45 };
  const tremorPhase = random() * Math.PI * 2;
  const mainShare = overshoot > 0 ? 1 - CORRECTION_SHARE : 1;

  const at = (progress: number): Point => {
    const clamped = Math.min(1, Math.max(0, progress));
    if (clamped >= 1) return to;
    if (clamped > mainShare) {
      const settle = minimumJerk((clamped - mainShare) / CORRECTION_SHARE);
      return { x: end.x + (to.x - end.x) * settle, y: end.y + (to.y - end.y) * settle };
    }
    const along = clamped / mainShare;
    const point = cubicBezier(from, control1, control2, end, minimumJerk(along));
    // A hand never moves perfectly smoothly: a faint wobble, fading out at both ends.
    const tremor = Math.sin(along * Math.PI) * 0.9 * Math.sin(along * 23 + tremorPhase);
    return { x: point.x - unitY * tremor, y: point.y + unitX * tremor };
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
