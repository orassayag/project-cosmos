import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useViewport } from '../hooks/useViewport';
import { createRandom, landingOffset, landingPoint, planPointerPath, seedFromText, type Point } from '../demo/humanMotion';
import { findDemoTarget, POINTER_MOVE_MS, scaledDuration } from '../demo/runDemo';
import type { DemoTarget } from '../demo/types';
import type { DemoPointerMove } from '../demo/useDemoRunner';

export const POINTER_PRESS_MS = 180;
/** The pause between the pointer arriving and the press, as a person settles on the target. */
export const POINTER_AIM_MS = 140;

interface DemoPointerProps {
  pointer: DemoPointerMove | null;
  isVisible: boolean;
  speed: number;
}

function findTargetRect(target: DemoTarget): DOMRect | null {
  return findDemoTarget(target)?.getBoundingClientRect() ?? null;
}

function startPosition(): Point {
  return { x: window.innerWidth * 0.55, y: window.innerHeight * 0.62 };
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The demo's on-screen cursor. Each move follows a hand-like path to a spot near the middle of
 * the target, settles, and dips as the runner's press lands. The press itself is the runner's;
 * this only shows where it happens.
 */
export function DemoPointer({ pointer, isVisible, speed }: DemoPointerProps) {
  const { isMobile, isTouch } = useViewport();
  const elementRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<Point | null>(null);
  const landingOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const [hasAppeared, setHasAppeared] = useState(false);
  const isShown = isVisible && !isMobile && !isTouch;
  const target = pointer?.target ?? null;
  const moveId = pointer?.moveId ?? 0;

  useEffect(() => {
    if (!isShown || target === null) return;
    const rect = findTargetRect(target);
    if (!rect) return;
    const random = createRandom(seedFromText(`${target}#${moveId}`));
    landingOffsetRef.current = landingOffset(random);
    const destination = landingPoint(rect, landingOffsetRef.current);
    const origin = positionRef.current ?? startPosition();
    const path = planPointerPath(origin, destination, random, POINTER_MOVE_MS - POINTER_AIM_MS);
    const durationMs = prefersReducedMotion() ? 0 : scaledDuration(path.durationMs, speed);

    const place = (point: Point) => {
      positionRef.current = point;
      if (elementRef.current) elementRef.current.style.transform = `translate(${point.x}px, ${point.y}px)`;
    };
    let startedAt: number | null = null;
    const advance = (now: number) => {
      startedAt ??= now;
      const progress = durationMs <= 0 ? 1 : (now - startedAt) / durationMs;
      place(path.at(progress));
      if (progress < 1) frame = window.requestAnimationFrame(advance);
    };
    place(origin);
    let frame = window.requestAnimationFrame((now) => {
      setHasAppeared(true);
      advance(now);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isShown, target, moveId, speed]);

  useEffect(() => {
    if (!isShown || target === null) return;
    const followTarget = () => {
      const rect = findTargetRect(target);
      if (!rect || !elementRef.current) return;
      positionRef.current = landingPoint(rect, landingOffsetRef.current);
      elementRef.current.style.transform = `translate(${positionRef.current.x}px, ${positionRef.current.y}px)`;
    };
    window.addEventListener('resize', followTarget);
    return () => window.removeEventListener('resize', followTarget);
  }, [isShown, target]);

  if (!isShown) return null;

  const pressStyle = {
    animationDelay: `${scaledDuration(POINTER_MOVE_MS, speed)}ms`,
    animationDuration: `${scaledDuration(POINTER_PRESS_MS, speed)}ms`,
  };
  return createPortal(
    <div
      ref={elementRef}
      className="lc-demo-pointer"
      aria-hidden="true"
      data-testid="demo-pointer"
      style={{ visibility: hasAppeared ? 'visible' : 'hidden' }}
    >
      {moveId > 0 && <span key={`ring-${moveId}`} className="lc-demo-pointer-ripple" style={pressStyle} />}
      <svg
        key={`arrow-${moveId}`}
        className="lc-demo-pointer-arrow"
        style={moveId > 0 ? pressStyle : undefined}
        width={12}
        height={19}
        viewBox="0 0 12 19"
      >
        <path
          d="M1 1 L1 15.2 L4.3 12.2 L7.6 18 L9.6 17 L6.5 11.3 L10.9 11.1 Z"
          fill="#000000"
          stroke="#FFFFFF"
          strokeWidth={1.1}
          strokeLinejoin="round"
          paintOrder="stroke"
        />
      </svg>
    </div>,
    document.body,
  );
}
