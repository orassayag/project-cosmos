import { useEffect, useState } from 'react';

/**
 * Reactive viewport classification for the responsive shell. Reads the
 * two breakpoints the layout cares about (phone / tablet) plus whether the
 * primary input is coarse (touch), and mirrors them onto <html> as
 * `data-viewport` / `data-touch` so CSS can key off the same source of truth
 * the JS layout does.
 */

// Phone-class: a narrow width OR a short height. The height clause catches
// phones held in landscape, where the width alone is wide enough to look like
// a desktop but there is nowhere near the vertical room the full-height panels
// assume — so they'd otherwise take over the whole screen.
export const MOBILE_QUERY ='(max-width: 768px), (max-height: 480px)';
const TABLET_QUERY = '(max-width: 1024px)';
const COARSE_QUERY = '(pointer: coarse)';

export interface Viewport {
  /** Phone-class width — the shell collapses chrome into the drawer here. */
  isMobile: boolean;
  /** Phone or small tablet — panels dock as bottom sheets. */
  isTablet: boolean;
  /** Primary pointer is coarse (finger). Enables touch-only affordances. */
  isTouch: boolean;
}

function read(): Viewport {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { isMobile: false, isTablet: false, isTouch: false };
  }
  return {
    isMobile: window.matchMedia(MOBILE_QUERY).matches,
    isTablet: window.matchMedia(TABLET_QUERY).matches,
    isTouch: window.matchMedia(COARSE_QUERY).matches,
  };
}

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(read);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const queries = [MOBILE_QUERY, TABLET_QUERY, COARSE_QUERY].map((q) => window.matchMedia(q));
    const sync = () => setViewport(read());
    queries.forEach((mq) => mq.addEventListener('change', sync));
    sync();
    return () => queries.forEach((mq) => mq.removeEventListener('change', sync));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.viewport = viewport.isMobile ? 'mobile' : viewport.isTablet ? 'tablet' : 'desktop';
    root.dataset.touch = viewport.isTouch ? 'true' : 'false';
  }, [viewport]);

  return viewport;
}
