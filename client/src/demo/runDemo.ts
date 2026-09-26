import type { DemoActions, DemoScript, DemoStep } from './types';

export type DemoRunResult = 'done' | 'aborted';

export interface DemoRunOptions {
  signal: AbortSignal;
  speed: number;
  /** Fires before each step's actions, so the pointer and caption can follow the script. */
  onStepStart?: (step: DemoStep, stepIndex: number) => void;
}

/** How long the search button looks pressed before the question is asked, at speed 1. */
export const SEARCH_PRESS_MS = 150;

const ABORTING_INPUT_EVENTS = ['pointerdown', 'keydown'] as const;

export function scaledDuration(durationMs: number, speed: number): number {
  return durationMs / speed;
}

/** Resolves `true` when the time elapses, `false` as soon as the signal aborts. */
export function sleep(durationMs: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timeoutId);
      resolve(false);
    };
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, durationMs);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Aborts on the viewer's own pointer or key press. Synthetic (untrusted) events are ignored,
 * so nothing the app or the runner dispatches can stop the demo. Returns the cleanup.
 */
export function abortOnTrustedInput(
  controller: AbortController,
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = window,
): () => void {
  const onInput = (event: Event) => {
    if (event.isTrusted) controller.abort();
  };
  for (const eventType of ABORTING_INPUT_EVENTS) target.addEventListener(eventType, onInput);
  return () => {
    for (const eventType of ABORTING_INPUT_EVENTS) target.removeEventListener(eventType, onInput);
  };
}

/**
 * Runs one step: its actions fire first, then the step's duration elapses. Steps with an
 * in-between state (`connect`, `ask`) split the duration instead of adding to it.
 */
async function runStep(
  step: DemoStep,
  actions: DemoActions,
  wait: (durationMs: number) => Promise<boolean>,
): Promise<boolean> {
  switch (step.kind) {
    case 'pressIntro':
      actions.pressIntro();
      break;
    case 'pickDomain':
      actions.pickDomain(step.domainId);
      break;
    case 'type':
      actions.setQuestion(step.text);
      break;
    case 'openConnect':
      actions.openConnect();
      break;
    case 'pickProvider':
      actions.pickProvider(step.provider);
      break;
    case 'paste':
      actions.setConnectField(step.field, step.value);
      break;
    case 'connect':
      actions.setAiStatus('connecting');
      if (!(await wait(step.durationMs))) return false;
      actions.setAiStatus('connected');
      return true;
    case 'closeConnect':
      actions.closeConnect();
      break;
    case 'ask': {
      const pressMs = Math.min(SEARCH_PRESS_MS, step.durationMs);
      actions.setSearchPressed(true);
      if (!(await wait(pressMs))) return false;
      actions.setSearchPressed(false);
      actions.ask(step.question);
      return wait(step.durationMs - pressMs);
    }
    case 'answer':
      actions.playAnswer(step.answer);
      break;
    case 'playScenario':
      actions.playScenario(step.scenarioId);
      break;
    case 'stepBack':
      actions.stepBack();
      break;
    case 'stepForward':
      actions.stepForward();
      break;
    case 'openIncident':
      actions.openIncident(step.incidentId);
      break;
    case 'toggleLegend':
      actions.toggleLegend(step.isVisible);
      break;
    case 'wait':
      break;
    case 'endCard':
      actions.showEndCard();
      break;
  }
  return wait(step.durationMs);
}

/**
 * Plays the script one step at a time. It changes the app only through `actions` and never
 * dispatches DOM events: the buttons act on mouse-down and the map's pan handler swallows
 * background presses, so synthetic clicks would do nothing. Never throws on abort.
 */
export async function runDemo(
  script: DemoScript,
  actions: DemoActions,
  { signal, speed, onStepStart }: DemoRunOptions,
): Promise<DemoRunResult> {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new RangeError(`Demo speed must be a positive number, received ${speed}.`);
  }
  const wait = (durationMs: number) => sleep(scaledDuration(durationMs, speed), signal);

  for (const [stepIndex, step] of script.entries()) {
    if (signal.aborted) return 'aborted';
    onStepStart?.(step, stepIndex);
    if (!(await runStep(step, actions, wait))) return 'aborted';
  }
  return signal.aborted ? 'aborted' : 'done';
}
