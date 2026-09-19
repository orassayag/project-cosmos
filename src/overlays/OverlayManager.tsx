import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * A single-slot manager for mutually-exclusive UI surfaces (modals, slide-overs,
 * map overlays). Only one overlay id can be "active" at a time — opening any one
 * closes whatever was open, so no surface ever stacks on or overrides another.
 *
 * Every current and future modal should register through this instead of owning
 * a private `open` boolean: give it a stable id, drive its visibility from
 * `isOpen(id)`, and open/close/toggle it through this manager. A surface that
 * keeps extra local state (a filter, a selection) resets that state when it sees
 * the active id move away from its own — see the Map overlays for the pattern.
 */
export interface OverlayManager {
  /** The id of the single currently-open overlay, or null when none is open. */
  active: string | null;
  /** Open `id`, closing any other overlay that was open. */
  open: (id: string) => void;
  /** Close `id` — a no-op unless `id` is the one currently open. */
  close: (id: string) => void;
  /** Open `id` if closed, close it if it is the active one. */
  toggle: (id: string) => void;
  isOpen: (id: string) => boolean;
  /** Close every overlay (used by the "reset the galaxy" flow). */
  reset: () => void;
}

const OverlayContext = createContext<OverlayManager | null>(null);

/** Owns the single-slot state. Call once at the top of the tree, provide the
 *  returned value, and consume it with {@link useOverlay}. */
export function useOverlayManager(): OverlayManager {
  const [active, setActive] = useState<string | null>(null);
  return useMemo(
    () => ({
      active,
      open: (id) => setActive(id),
      close: (id) => setActive((current) => (current === id ? null : current)),
      toggle: (id) => setActive((current) => (current === id ? null : id)),
      isOpen: (id) => active === id,
      reset: () => setActive(null),
    }),
    [active],
  );
}

export function OverlayProvider({ value, children }: { value: OverlayManager; children: ReactNode }) {
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay(): OverlayManager {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within an OverlayProvider');
  return ctx;
}

/** Stable overlay ids. Adding a new modal? Give it an id here so the manager
 *  (and anyone reasoning about exclusivity) has a single source of truth. */
export const OVERLAY = {
  ask: 'ask',
  changelog: 'changelog',
  mapOwnership: 'map-ownership',
  mapChanges: 'map-changes',
  mapBlast: 'map-blast',
  mapHealth: 'map-health',
  mapLayout: 'map-layout',
} as const;
