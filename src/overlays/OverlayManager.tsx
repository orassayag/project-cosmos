import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useViewport } from '../hooks/useViewport';

/**
 * A single-slot manager for mutually-exclusive UI surfaces (modals, slide-overs,
 * map overlays). Only one overlay id can be "active" at a time — opening any one
 * closes whatever was open, so no surface ever stacks on or overrides another.
 *
 * Every current and future modal should register through this instead of owning
 * a private `open` boolean: give it a stable id, drive its visibility from
 * `isOpen(id)`, and open/close/toggle it through this manager. A surface that
 * keeps extra local state (a filter, a selection) resets that state when it sees
 * its id leave the stack (`isStacked`) — see the Map overlays for the pattern.
 *
 * On phones the slot becomes a stack: opening a surface buries the current one
 * instead of closing it, and closing the top surface brings back the one beneath
 * it with its state intact. Only the top of the stack is `active` / visible.
 */
export interface OverlayManager {
  /** The id of the single currently-open (top) overlay, or null when none is open. */
  active: string | null;
  /** Open `id` on top — closing any other overlay on desktop, burying it on phones. */
  open: (id: string) => void;
  /** Remove `id` wherever it sits, revealing the overlay beneath it (phones). */
  close: (id: string) => void;
  /** Close `id` if it is the active one, otherwise open it. */
  toggle: (id: string) => void;
  isOpen: (id: string) => boolean;
  /** True while `id` is open or buried under another overlay (phones). */
  isStacked: (id: string) => boolean;
  /** Close every overlay (used by the "reset the galaxy" flow). */
  reset: () => void;
}

const OverlayContext = createContext<OverlayManager | null>(null);

/** Owns the overlay stack. Call once at the top of the tree, provide the
 *  returned value, and consume it with {@link useOverlay}. */
export function useOverlayManager(): OverlayManager {
  const { isMobile } = useViewport();
  const [stack, setStack] = useState<string[]>([]);
  const active = stack.length ? stack[stack.length - 1] : null;

  // Leaving phone layout collapses the stack back to a single slot.
  useEffect(() => {
    if (!isMobile) setStack((current) => (current.length > 1 ? current.slice(-1) : current));
  }, [isMobile]);

  const pushOnTop = useCallback(
    (current: string[], id: string) => (isMobile ? [...current.filter((entry) => entry !== id), id] : [id]),
    [isMobile],
  );
  const open = useCallback(
    (id: string) => setStack((current) => (current[current.length - 1] === id ? current : pushOnTop(current, id))),
    [pushOnTop],
  );
  const close = useCallback(
    (id: string) => setStack((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : current)),
    [],
  );
  const toggle = useCallback(
    (id: string) =>
      setStack((current) => (current[current.length - 1] === id ? current.slice(0, -1) : pushOnTop(current, id))),
    [pushOnTop],
  );

  return useMemo(
    () => ({
      active,
      open,
      close,
      toggle,
      isOpen: (id) => active === id,
      isStacked: (id) => stack.includes(id),
      reset: () => setStack([]),
    }),
    [active, stack, open, close, toggle],
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
  help: 'help',
  mapOwnership: 'map-ownership',
  mapChanges: 'map-changes',
  mapBlast: 'map-blast',
  mapHealth: 'map-health',
  mapLayout: 'map-layout',
  /** The star/topic inspector. Registered only on phones, where it joins the
   *  stack; on desktop it coexists with the map overlays as local state. */
  inspector: 'inspector',
} as const;
