import type { DemoMode } from './types';

export const INTRO_SEEN_STORAGE_KEY = 'cosmos-intro-seen';

const MIN_SPEED = 1;
const MAX_SPEED = 8;

function parseSpeed(rawSpeed: string | null): number {
  const speed = Number(rawSpeed);
  if (rawSpeed === null || !Number.isFinite(speed)) return MIN_SPEED;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
}

export function readDemoMode(url: string): DemoMode | null {
  const params = new URL(url).searchParams;
  const mode = params.get('demo');
  if (mode !== 'ai' && mode !== 'all') return null;
  return { mode, speed: parseSpeed(params.get('speed')) };
}

/**
 * Takes a read-only storage view so demo mode can never mark the intro as seen —
 * a later normal visit must still get it.
 */
export function shouldShowIntro(
  demoMode: DemoMode | null,
  storage: Pick<Storage, 'getItem'>,
  hasDeepLink = false,
): boolean {
  if (demoMode?.mode === 'ai') return false;
  // The `all` script's first step presses the intro button, so the intro must be there.
  if (demoMode?.mode === 'all') return true;
  return !hasDeepLink && !storage.getItem(INTRO_SEEN_STORAGE_KEY);
}
