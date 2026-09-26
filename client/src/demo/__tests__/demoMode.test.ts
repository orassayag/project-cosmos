import { describe, expect, it, vi } from 'vitest';
import { DOMAINS } from '../../scenarios/data';
import { INTRO_SEEN_STORAGE_KEY, readDemoMode, shouldShowIntro } from '../demoMode';
import { DEMO_TARGETS } from '../types';

const BASE_URL = 'http://localhost:5173/';

function spyStorage(seenValue: string | null) {
  return {
    getItem: vi.fn((key: string) => (key === INTRO_SEEN_STORAGE_KEY ? seenValue : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
}

describe('readDemoMode', () => {
  it('reads demo=ai with the default speed', () => {
    expect(readDemoMode(`${BASE_URL}?demo=ai`)).toEqual({ mode: 'ai', speed: 1 });
  });

  it('reads demo=all', () => {
    expect(readDemoMode(`${BASE_URL}?demo=all&speed=2`)).toEqual({ mode: 'all', speed: 2 });
  });

  it('returns null for an unknown or missing demo value', () => {
    expect(readDemoMode(`${BASE_URL}?demo=tour`)).toBeNull();
    expect(readDemoMode(`${BASE_URL}?demo=`)).toBeNull();
    expect(readDemoMode(BASE_URL)).toBeNull();
  });

  it.each([
    ['0', 1],
    ['20', 8],
    ['abc', 1],
    ['-3', 1],
    ['4', 4],
  ])('clamps speed=%s to %d', (rawSpeed, expectedSpeed) => {
    expect(readDemoMode(`${BASE_URL}?demo=ai&speed=${rawSpeed}`)?.speed).toBe(expectedSpeed);
  });
});

describe('shouldShowIntro', () => {
  it('skips the intro for demo=ai even in a fresh browser', () => {
    expect(shouldShowIntro({ mode: 'ai', speed: 1 }, spyStorage(null))).toBe(false);
  });

  it('shows the intro for demo=all in a fresh browser and after a previous visit', () => {
    expect(shouldShowIntro({ mode: 'all', speed: 1 }, spyStorage(null))).toBe(true);
    expect(shouldShowIntro({ mode: 'all', speed: 1 }, spyStorage('1'))).toBe(true);
  });

  it('keeps the normal rule outside demo mode', () => {
    expect(shouldShowIntro(null, spyStorage(null))).toBe(true);
    expect(shouldShowIntro(null, spyStorage('1'))).toBe(false);
    expect(shouldShowIntro(null, spyStorage(null), true)).toBe(false);
  });

  it('never writes storage', () => {
    const storage = spyStorage(null);
    shouldShowIntro({ mode: 'ai', speed: 1 }, storage);
    shouldShowIntro({ mode: 'all', speed: 1 }, storage);
    shouldShowIntro(null, storage);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});

describe('DEMO_TARGETS', () => {
  it('names a target for every domain button', () => {
    for (const domain of DOMAINS) {
      expect(DEMO_TARGETS).toContain(`domain-${domain.id}`);
    }
  });
});
