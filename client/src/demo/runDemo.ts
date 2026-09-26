import { typingDelaysMs } from './humanMotion';
import type { DemoScript, DemoStep, DemoTarget } from './types';

export type DemoRunResult = 'done' | 'aborted';

export interface DemoRunOptions {
  signal: AbortSignal;
  speed: number;
  /** Fires before each step, so the caption can follow the script. */
  onStepStart?: (step: DemoStep, stepIndex: number) => void;
  /** Fires once the step's target is on screen; the pointer glides there before it is pressed. */
  onPointerMove?: (target: DemoTarget) => void;
  /** Where targets are looked up; tests pass a container. */
  root?: ParentNode;
}

/** From the pointer setting off to the press, at speed 1: the move itself plus a beat of aiming. */
export const POINTER_MOVE_MS = 700;

/** How long a step waits for its target to render (a menu opening, the intro warp ending), at speed 1. */
export const TARGET_TIMEOUT_MS = 6000;
const TARGET_POLL_MS = 50;

const ABORTING_INPUT_EVENTS = ['pointerdown', 'keydown'] as const;

export class DemoTargetMissingError extends Error {
  readonly target: DemoTarget;

  constructor(target: DemoTarget) {
    super(`Demo target "${target}" never appeared on screen within ${TARGET_TIMEOUT_MS}ms — the flow it belongs to did not open.`);
    this.name = 'DemoTargetMissingError';
    this.target = target;
  }
}

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
 * Aborts on the viewer's own pointer or key press. The runner's own events are untrusted, so
 * they never stop the demo. Returns the cleanup.
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

export function findDemoTarget(target: DemoTarget, root: ParentNode = document): HTMLElement | null {
  const element = root.querySelector<HTMLElement>(`[data-demo-target="${CSS.escape(target)}"]`);
  if (!element || !element.isConnected) return null;
  // jsdom has no `checkVisibility`; there, a connected element counts as shown.
  const isShown = typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
  return isShown ? element : null;
}

function mouseInit(element: HTMLElement, buttons: number): MouseEventInit {
  const rect = element.getBoundingClientRect();
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    buttons,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
}

function dispatchPointer(element: HTMLElement, type: 'pointerdown' | 'pointerup', buttons: number): void {
  const init = { ...mouseInit(element, buttons), pointerId: 1, pointerType: 'mouse', isPrimary: true };
  const PointerEventClass = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  element.dispatchEvent(new PointerEventClass(type, init));
}

/**
 * The event sequence a real mouse click produces, including mouse-down's default of moving
 * focus — which dispatched events do not get from the browser.
 */
export function pressElement(element: HTMLElement): void {
  dispatchPointer(element, 'pointerdown', 1);
  const isFocusAllowed = element.dispatchEvent(new MouseEvent('mousedown', mouseInit(element, 1)));
  if (isFocusAllowed) {
    if (element.matches('button, input, textarea, select, a[href], [tabindex]')) element.focus({ preventScroll: true });
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  dispatchPointer(element, 'pointerup', 0);
  element.dispatchEvent(new MouseEvent('mouseup', mouseInit(element, 0)));
  element.dispatchEvent(new MouseEvent('click', mouseInit(element, 0)));
}

/** Sets the value through the native setter, so React's change tracking sees the edit as the viewer's. */
function setNativeValue(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value);
}

function asTextField(element: HTMLElement, target: DemoTarget): HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element;
  throw new TypeError(`Demo target "${target}" is a <${element.tagName.toLowerCase()}>, but typing needs an input or textarea.`);
}

function insertText(field: HTMLInputElement | HTMLTextAreaElement, text: string, inputType: 'insertText' | 'insertFromPaste'): void {
  setNativeValue(field, field.value + text);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data: text }));
}

function typeCharacter(field: HTMLInputElement | HTMLTextAreaElement, character: string): void {
  const keyInit = { key: character, bubbles: true, cancelable: true };
  const isAllowed = field.dispatchEvent(new KeyboardEvent('keydown', keyInit));
  if (isAllowed) insertText(field, character, 'insertText');
  field.dispatchEvent(new KeyboardEvent('keyup', keyInit));
}

interface StepClock {
  /** Sleeps `durationMs` at speed 1 (scaled by the run speed) and counts it against the step. */
  wait: (durationMs: number) => Promise<boolean>;
  spentMs: () => number;
}

function createStepClock(signal: AbortSignal, speed: number): StepClock {
  let spentMs = 0;
  return {
    wait: (durationMs) => {
      spentMs += durationMs;
      return sleep(scaledDuration(durationMs, speed), signal);
    },
    spentMs: () => spentMs,
  };
}

async function waitForTarget(target: DemoTarget, root: ParentNode, clock: StepClock): Promise<HTMLElement | null> {
  for (let waitedMs = 0; ; waitedMs += TARGET_POLL_MS) {
    const element = findDemoTarget(target, root);
    if (element) return element;
    if (waitedMs >= TARGET_TIMEOUT_MS) throw new DemoTargetMissingError(target);
    if (!(await clock.wait(TARGET_POLL_MS))) return null;
  }
}

/** Runs one step, then pauses for whatever is left of its duration. Resolves `false` on abort. */
async function runStep(step: DemoStep, options: DemoRunOptions, root: ParentNode): Promise<boolean> {
  const clock = createStepClock(options.signal, options.speed);
  if (step.kind !== 'wait') {
    const element = await waitForTarget(step.target, root, clock);
    if (!element) return false;
    options.onPointerMove?.(step.target);
    if (!(await clock.wait(POINTER_MOVE_MS))) return false;
    if (!element.isConnected) throw new DemoTargetMissingError(step.target);
    pressElement(element);

    if (step.kind === 'paste') insertText(asTextField(element, step.target), step.text, 'insertFromPaste');
    if (step.kind === 'type') {
      const field = asTextField(element, step.target);
      const delaysMs = typingDelaysMs(step.text);
      for (const [index, character] of [...step.text].entries()) {
        typeCharacter(field, character);
        if (!(await clock.wait(delaysMs[index]))) return false;
      }
    }
  }
  return clock.wait(Math.max(0, step.durationMs - clock.spentMs()));
}

/**
 * Plays the script one viewer gesture at a time against the real UI: the pointer moves to each
 * target and the runner dispatches the same pointer, mouse, keyboard and input events a person
 * would, so every change goes through the app's own handlers. Never throws on abort; throws
 * `DemoTargetMissingError` when a step's target never shows.
 */
export async function runDemo(script: DemoScript, options: DemoRunOptions): Promise<DemoRunResult> {
  const { signal, speed, onStepStart, root = document } = options;
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new RangeError(`Demo speed must be a positive number, received ${speed}.`);
  }

  for (const [stepIndex, step] of script.entries()) {
    if (signal.aborted) return 'aborted';
    onStepStart?.(step, stepIndex);
    if (!(await runStep(step, options, root))) return 'aborted';
  }
  return signal.aborted ? 'aborted' : 'done';
}
