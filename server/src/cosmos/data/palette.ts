import type { PaletteKey } from '../types.js';

// Each service's `hex` must equal its palette entry; `violet` has no service yet and backs the UI nebula.
export const PALETTE: Record<PaletteKey, string> = {
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#f5b731',
  red: '#f55b5b',
  violet: '#a78bfa',
  blue: '#4f8ff7',
  pink: '#f472b6',
  magenta: '#e879f9',
  orange: '#fb923c',
  teal: '#38bdf8',
  rose: '#ec4899',
  purple: '#a855f7',
  emerald: '#34a853',
};
