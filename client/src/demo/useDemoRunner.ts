import { useEffect, useRef, useState } from 'react';
import { abortOnTrustedInput, DemoTargetMissingError, runDemo, type DemoRunResult } from './runDemo';
import type { DemoScript, DemoTarget } from './types';

export type DemoEndResult = DemoRunResult | 'failed';
export type DemoRunStatus = 'idle' | 'running' | DemoEndResult;

type InputTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export interface UseDemoRunnerOptions {
  /** `undefined` means no demo: nothing runs and the status stays `idle`. */
  script: DemoScript | undefined;
  speed: number;
  /** Called once when the run finishes, is aborted or fails, never on unmount. */
  onEnd: (result: DemoEndResult) => void;
  /** Where viewer input is listened for; tests pass a fake because jsdom events are never trusted. */
  inputTarget?: InputTarget;
}

/** Each move gets a fresh id, so pressing the same target twice still glides and ripples twice. */
export interface DemoPointerMove {
  target: DemoTarget;
  moveId: number;
}

export interface DemoRunner {
  status: DemoRunStatus;
  isActive: boolean;
  /** The latest step caption; a step without one keeps the previous caption. */
  caption: string | null;
  /** The latest pointer move; `null` until the first gesture. */
  pointer: DemoPointerMove | null;
  /** Whether the pointer and caption should show — false once the run has ended. */
  isOverlayVisible: boolean;
}

/** The document attribute end-to-end recordings wait for: `running`, then `done`, `aborted` or `failed`. */
export const DEMO_STATE_ATTRIBUTE = 'data-demo-state';
/** Set with `failed`: why the run stopped, for the recorder to print. */
export const DEMO_ERROR_ATTRIBUTE = 'data-demo-error';

/**
 * Plays `script` once on mount. A trusted pointer or key press aborts it; every timer and
 * listener dies with the run's AbortController, including on unmount.
 */
export function useDemoRunner({ script, speed, onEnd, inputTarget = window }: UseDemoRunnerOptions): DemoRunner {
  const [status, setStatus] = useState<DemoRunStatus>(script ? 'running' : 'idle');
  const [caption, setCaption] = useState<string | null>(null);
  const [pointer, setPointer] = useState<DemoPointerMove | null>(null);

  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  useEffect(() => {
    if (!script) return;
    const controller = new AbortController();
    const stopListening = abortOnTrustedInput(controller, inputTarget);
    const root = document.documentElement;
    let isUnmounted = false;
    let moveId = 0;
    root.setAttribute(DEMO_STATE_ATTRIBUTE, 'running');

    const finish = (result: DemoEndResult) => {
      stopListening();
      if (isUnmounted) return;
      root.setAttribute(DEMO_STATE_ATTRIBUTE, result);
      setStatus(result);
      onEndRef.current(result);
    };

    runDemo(script, {
      signal: controller.signal,
      speed,
      onStepStart: (step) => {
        if (step.caption !== undefined) setCaption(step.caption);
      },
      onPointerMove: (target) => {
        moveId += 1;
        setPointer({ target, moveId });
      },
    }).then(finish, (error: unknown) => {
      root.setAttribute(DEMO_ERROR_ATTRIBUTE, error instanceof Error ? error.message : String(error));
      finish('failed');
      // A missing target is an expected way for a flow to break; anything else is a bug worth surfacing.
      if (!(error instanceof DemoTargetMissingError)) throw error;
    });

    return () => {
      isUnmounted = true;
      controller.abort();
      stopListening();
      root.removeAttribute(DEMO_STATE_ATTRIBUTE);
      root.removeAttribute(DEMO_ERROR_ATTRIBUTE);
    };
  }, [script, speed, inputTarget]);

  const isActive = status === 'running';
  return { status, isActive, caption, pointer, isOverlayVisible: isActive };
}
