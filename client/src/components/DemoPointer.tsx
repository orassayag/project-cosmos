import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useViewport } from '../hooks/useViewport';
import { scaledDuration } from '../demo/runDemo';
import type { DemoTarget } from '../demo/types';

export const POINTER_MOVE_MS = 500;
export const POINTER_RIPPLE_MS = 300;

interface PointerPosition {
  x: number;
  y: number;
}

interface DemoPointerProps {
  target: DemoTarget | null;
  isVisible: boolean;
  speed: number;
}

export function findDemoTargetCenter(target: DemoTarget): PointerPosition | null {
  const element = document.querySelector(`[data-demo-target="${target}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function startPosition(): PointerPosition {
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.66 };
}

/** The demo's fake cursor: glides to each step's `data-demo-target` element, then ripples as if clicking it. */
export function DemoPointer({ target, isVisible, speed }: DemoPointerProps) {
  const { isMobile, isTouch } = useViewport();
  const [position, setPosition] = useState<PointerPosition | null>(null);
  const [arrivalCount, setArrivalCount] = useState(0);
  const isShown = isVisible && !isMobile && !isTouch;

  useEffect(() => {
    if (!isShown || target === null) return;
    const destination = findDemoTargetCenter(target);
    if (!destination) return;
    // The start position must be painted for a frame before the move, or the first glide jumps instead of transitioning.
    setPosition((current) => current ?? startPosition());
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        setPosition(destination);
        setArrivalCount((count) => count + 1);
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isShown, target]);

  useEffect(() => {
    if (!isShown || target === null) return;
    const followTarget = () => {
      const destination = findDemoTargetCenter(target);
      if (destination) setPosition(destination);
    };
    window.addEventListener('resize', followTarget);
    return () => window.removeEventListener('resize', followTarget);
  }, [isShown, target]);

  if (!isShown || position === null) return null;

  const moveMs = scaledDuration(POINTER_MOVE_MS, speed);
  return createPortal(
    <div
      className="lc-demo-pointer"
      aria-hidden="true"
      data-testid="demo-pointer"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transitionDuration: `${moveMs}ms`,
      }}
    >
      {arrivalCount > 0 && (
        <span
          key={arrivalCount}
          className="lc-demo-pointer-ripple"
          style={{
            animationDelay: `${moveMs}ms`,
            animationDuration: `${scaledDuration(POINTER_RIPPLE_MS, speed)}ms`,
          }}
        />
      )}
      <svg className="lc-demo-pointer-arrow" width={22} height={28} viewBox="0 0 22 28">
        <path
          d="M1.5 1.5 L1.5 22.5 L7 17.5 L10.8 26 L14.4 24.4 L10.7 16.2 L18.5 16.2 Z"
          fill="#F5F7FF"
          stroke="#04060A"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    document.body,
  );
}
