import { describe, expect, it } from 'vitest';
import {
  createRandom,
  landingOffset,
  landingPoint,
  planPointerPath,
  seedFromText,
  typingDelaysMs,
  typingDurationMs,
} from '../humanMotion';

const FROM = { x: 100, y: 800 };
const TO = { x: 1500, y: 60 };

function distanceFromLine(point: { x: number; y: number }): number {
  const lengthX = TO.x - FROM.x;
  const lengthY = TO.y - FROM.y;
  return Math.abs(lengthY * point.x - lengthX * point.y + TO.x * FROM.y - TO.y * FROM.x) / Math.hypot(lengthX, lengthY);
}

describe('createRandom', () => {
  it('repeats the same sequence for the same seed and stays in [0, 1)', () => {
    const first = createRandom(42);
    const second = createRandom(42);
    for (let index = 0; index < 50; index += 1) {
      const value = first();
      expect(value).toBe(second());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(seedFromText('ask-input#1')).not.toBe(seedFromText('ask-input#2'));
  });
});

describe('landing', () => {
  it('lands inside the target, away from its edges and rarely dead centre', () => {
    const rect = { left: 10, top: 20, width: 100, height: 40 };
    const points = Array.from({ length: 40 }, (_unused, seed) => landingPoint(rect, landingOffset(createRandom(seed))));

    for (const point of points) {
      expect(point.x).toBeGreaterThan(rect.left + rect.width * 0.25);
      expect(point.x).toBeLessThan(rect.left + rect.width * 0.75);
      expect(point.y).toBeGreaterThan(rect.top + rect.height * 0.3);
      expect(point.y).toBeLessThan(rect.top + rect.height * 0.7);
    }
    expect(new Set(points.map((point) => Math.round(point.x))).size).toBeGreaterThan(10);
  });
});

describe('planPointerPath', () => {
  it('starts at the origin, ends exactly on the target, and fits the time budget', () => {
    const path = planPointerPath(FROM, TO, createRandom(7), 560);

    expect(path.at(0).x).toBeCloseTo(FROM.x, 0);
    expect(path.at(0).y).toBeCloseTo(FROM.y, 0);
    expect(path.at(1)).toEqual(TO);
    expect(path.durationMs).toBeLessThanOrEqual(560);
  });

  it('bows away from the straight line instead of moving like a ruler', () => {
    const path = planPointerPath(FROM, TO, createRandom(7), 560);
    expect(distanceFromLine(path.at(0.4))).toBeGreaterThan(20);
  });

  it('moves slowly at the start and end and fast in between', () => {
    const path = planPointerPath(FROM, TO, createRandom(3), 560);
    const travelled = (from: number, to: number) => Math.hypot(path.at(to).x - path.at(from).x, path.at(to).y - path.at(from).y);
    const averageStep = travelled(0, 1) / 20;

    expect(travelled(0, 0.05)).toBeLessThan(averageStep);
    expect(travelled(0.95, 1)).toBeLessThan(averageStep);
  });

  it('sometimes wanders off in a random direction before heading for the target', () => {
    const farthestFromLine = (seed: number) => {
      const path = planPointerPath(FROM, TO, createRandom(seed), 560);
      return Math.max(...Array.from({ length: 50 }, (_unused, index) => distanceFromLine(path.at(index / 50))));
    };
    const deviations = Array.from({ length: 30 }, (_unused, seed) => farthestFromLine(seed));

    expect(Math.max(...deviations)).toBeGreaterThan(Math.min(...deviations) * 2);
  });

  it('shakes instead of tracing a smooth curve', () => {
    const path = planPointerPath(FROM, TO, createRandom(11), 560);
    const turns = Array.from({ length: 200 }, (_unused, index) => {
      const [previous, current, next] = [index, index + 1, index + 2].map((sample) => path.at(0.2 + sample * 0.003));
      return Math.sign((current.x - previous.x) * (next.y - current.y) - (current.y - previous.y) * (next.x - current.x));
    });
    const turnFlips = turns.filter((sign, index) => index > 0 && sign !== 0 && sign !== turns[index - 1]).length;

    expect(turnFlips).toBeGreaterThan(4);
  });

  it('takes longer for a long move than a short one', () => {
    const short = planPointerPath(FROM, { x: FROM.x + 40, y: FROM.y }, createRandom(1), 2000);
    const long = planPointerPath(FROM, TO, createRandom(1), 2000);
    expect(long.durationMs).toBeGreaterThan(short.durationMs + 150);
  });
});

describe('typingDelaysMs', () => {
  it('gives each character an uneven pause, longer after word breaks and punctuation', () => {
    const text = 'What changed in the Fulfillment Galaxy over the past 24 hours?';
    const delaysMs = typingDelaysMs(text);

    expect(delaysMs).toHaveLength(text.length);
    expect(new Set(delaysMs).size).toBeGreaterThan(15);
    expect(delaysMs[text.length - 1]).toBeGreaterThanOrEqual(90);
    expect(typingDelaysMs(text)).toEqual(delaysMs);
    expect(typingDurationMs(text)).toBe(delaysMs.reduce((sum, delayMs) => sum + delayMs, 0));
  });
});
