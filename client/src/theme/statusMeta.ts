import type { BlastLevel, DriftKind, HealthStatus, PaletteKey } from '../api/cosmos-api';

/** Theme-aware CSS color for a palette key; the tokens live in styles/tokens.css. */
export function paletteVar(key: PaletteKey): string {
  return `var(--svc-${key})`;
}

export const DRIFT_KIND_META: Record<DriftKind, { label: string; color: string; hex: string; glyph: string }> = {
  added:   { label: 'Added',   color: 'var(--svc-green)', hex: '#5FD08A', glyph: '🟢' },
  changed: { label: 'Changed', color: 'var(--svc-amber)', hex: '#E6C34A', glyph: '🟡' },
  risk:    { label: 'Risk',    color: 'var(--svc-red)',   hex: '#E8654A', glyph: '🔴' },
  removed: { label: 'Removed', color: 'var(--text-dim)',  hex: '#7A8088', glyph: '📦' },
};

export const HEALTH_STATUS_META: Record<
  HealthStatus,
  { label: string; color: string; hex: string; glyph: string; blurb: string }
> = {
  fresh: { label: 'Fresh', color: 'var(--svc-green)', hex: '#5FD08A', glyph: '🟢', blurb: 'touched recently, light load' },
  warm:  { label: 'Warm',  color: 'var(--svc-amber)', hex: '#E6C34A', glyph: '🟡', blurb: 'a bit stale or a busy queue' },
  hot:   { label: 'Hot',   color: 'var(--svc-red)',   hex: '#E8654A', glyph: '🔴', blurb: 'stale or a deep PR backlog' },
};

/** Hotter = closer to the change. */
export const BLAST_LEVEL_META: Record<BlastLevel, { label: string; hex: string }> = {
  source: { label: 'Changing this', hex: '#8FD3FF' },
  high:   { label: 'High',          hex: '#E8654A' },
  med:    { label: 'Medium',        hex: '#E6C34A' },
  low:    { label: 'Low',           hex: '#5FD08A' },
};

/** A distinct warning red so a historical replay never reads as live protocol-coloured traffic. */
export const INCIDENT_COMET_HEX = '#ff5a52';
