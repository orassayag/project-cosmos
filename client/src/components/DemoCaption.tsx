import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { scaledDuration } from '../demo/runDemo';

export const CAPTION_FADE_MS = 240;
const CONTROLS_GAP_PX = 12;

interface DemoCaptionProps {
  caption: string | null;
  isVisible: boolean;
  speed: number;
}

/** Distance from the viewport bottom that clears the playback controls, or `null` when none are showing. */
function readControlsClearance(): number | null {
  const controls = document.querySelector('.lc-controls');
  if (!controls) return null;
  const rect = controls.getBoundingClientRect();
  if (rect.height === 0) return null;
  return Math.round(window.innerHeight - rect.top + CONTROLS_GAP_PX);
}

/** One-line bottom-centre strip narrating the demo; a step without a caption leaves the last one showing. */
export function DemoCaption({ caption, isVisible, speed }: DemoCaptionProps) {
  const [controlsClearance, setControlsClearance] = useState<number | null>(null);
  const isShown = isVisible && caption !== null;

  // Re-measured per caption: a step that starts a scenario mounts the controls in the same render as its caption.
  useLayoutEffect(() => {
    if (!isShown) return;
    const measure = () => setControlsClearance(readControlsClearance());
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isShown, caption]);

  return createPortal(
    <div
      className="lc-demo-caption"
      aria-live="polite"
      data-visible={isShown ? 'true' : 'false'}
      style={isShown && controlsClearance !== null ? { bottom: `${controlsClearance}px` } : undefined}
    >
      {isShown && (
        <span
          key={caption}
          className="lc-demo-caption-text"
          style={{ animationDuration: `${scaledDuration(CAPTION_FADE_MS, speed)}ms` }}
        >
          {caption}
        </span>
      )}
    </div>,
    document.body,
  );
}
