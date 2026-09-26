import { useEffect, useRef, useState } from 'react';
import { abortOnTrustedInput, runDemo, type DemoRunResult } from './runDemo';
import type { DemoActions, DemoScript, DemoTarget } from './types';

export type DemoRunStatus = 'idle' | 'running' | DemoRunResult;

type InputTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export interface UseDemoRunnerOptions {
  /** `undefined` means no demo: nothing runs and the status stays `idle`. */
  script: DemoScript | undefined;
  speed: number;
  actions: DemoActions;
  /** Called once when the run finishes or is aborted, never on unmount. */
  onEnd: (result: DemoRunResult) => void;
  /** Where viewer input is listened for; tests pass a fake because jsdom events are never trusted. */
  inputTarget?: InputTarget;
}

export interface DemoRunner {
  status: DemoRunStatus;
  isActive: boolean;
  /** The latest step caption; a step without one keeps the previous caption. */
  caption: string | null;
  /** The latest step target; a step without one leaves the pointer where it was. */
  target: DemoTarget | null;
  /** Whether the pointer and caption should show — false once the run is done or aborted. */
  isOverlayVisible: boolean;
}

/** The document attribute end-to-end recordings wait for: `running`, then `done` or `aborted`. */
export const DEMO_STATE_ATTRIBUTE = 'data-demo-state';

function forwardTo(latestActions: { readonly current: DemoActions }): DemoActions {
  return new Proxy({} as DemoActions, {
    get: (_target, actionName: keyof DemoActions) =>
      (...args: unknown[]) => (latestActions.current[actionName] as (...callArgs: unknown[]) => void)(...args),
  });
}

/**
 * Plays `script` once on mount. A trusted pointer or key press aborts it; every timer and
 * listener dies with the run's AbortController, including on unmount.
 */
export function useDemoRunner({
  script,
  speed,
  actions,
  onEnd,
  inputTarget = window,
}: UseDemoRunnerOptions): DemoRunner {
  const [status, setStatus] = useState<DemoRunStatus>(script ? 'running' : 'idle');
  const [caption, setCaption] = useState<string | null>(null);
  const [target, setTarget] = useState<DemoTarget | null>(null);

  // App rebuilds its actions every render; the run reads the latest ones instead of restarting.
  const actionsRef = useRef(actions);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    actionsRef.current = actions;
    onEndRef.current = onEnd;
  });

  useEffect(() => {
    if (!script) return;
    const controller = new AbortController();
    const stopListening = abortOnTrustedInput(controller, inputTarget);
    const root = document.documentElement;
    let isUnmounted = false;
    root.setAttribute(DEMO_STATE_ATTRIBUTE, 'running');

    void runDemo(script, forwardTo(actionsRef), {
      signal: controller.signal,
      speed,
      onStepStart: (step) => {
        if (step.caption !== undefined) setCaption(step.caption);
        if (step.target !== undefined) setTarget(step.target);
      },
    }).then((result) => {
      stopListening();
      if (isUnmounted) return;
      root.setAttribute(DEMO_STATE_ATTRIBUTE, result);
      setStatus(result);
      onEndRef.current(result);
    });

    return () => {
      isUnmounted = true;
      controller.abort();
      stopListening();
      root.removeAttribute(DEMO_STATE_ATTRIBUTE);
    };
  }, [script, speed, inputTarget]);

  const isActive = status === 'running';
  return { status, isActive, caption, target, isOverlayVisible: isActive };
}
