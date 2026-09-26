import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  abortOnTrustedInput,
  DemoTargetMissingError,
  POINTER_MOVE_MS,
  pressElement,
  runDemo,
  scaledDuration,
  sleep,
  TARGET_TIMEOUT_MS,
} from '../runDemo';
import { typingDelaysMs } from '../humanMotion';
import type { DemoStep } from '../types';

function fakeInputTarget() {
  const listeners = new Map<string, EventListener>();
  return {
    addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    fire: (type: string, isTrusted: boolean) => listeners.get(type)?.({ type, isTrusted } as Event),
    listenerCount: () => listeners.size,
  };
}

function addElement<K extends keyof HTMLElementTagNameMap>(tag: K, target: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.setAttribute('data-demo-target', target);
  document.body.appendChild(element);
  return element;
}

/** Records every event type a target receives, in order. */
function recordEvents(element: HTMLElement, types: string[]): string[] {
  const seen: string[] = [];
  for (const type of types) element.addEventListener(type, () => seen.push(type));
  return seen;
}

const run = (script: DemoStep[], options: Partial<Parameters<typeof runDemo>[1]> = {}) =>
  runDemo(script, { signal: new AbortController().signal, speed: 1, ...options });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('sleep', () => {
  it('resolves true after the duration and leaves no timer behind', async () => {
    const promise = sleep(500, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves false on abort and clears its timer', async () => {
    const controller = new AbortController();
    const promise = sleep(500, controller.signal);
    controller.abort();
    await expect(promise).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('scaledDuration', () => {
  it('divides the duration by the speed', () => {
    expect(scaledDuration(1000, 4)).toBe(250);
    expect(scaledDuration(1000, 1)).toBe(1000);
  });
});

describe('pressElement', () => {
  it('fires the full mouse sequence a real click makes and focuses the element', () => {
    const button = addElement('button', 'ask-search');
    const seen = recordEvents(button, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);

    pressElement(button);

    expect(seen).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
    expect(document.activeElement).toBe(button);
  });

  it('keeps focus where it was when mouse-down is prevented, like the Search button does', () => {
    const field = addElement('textarea', 'ask-input');
    const button = addElement('button', 'ask-search');
    button.addEventListener('mousedown', (event) => event.preventDefault());
    field.focus();

    pressElement(button);

    expect(document.activeElement).toBe(field);
  });

  it('dispatches untrusted events, so the demo never aborts itself', () => {
    const button = addElement('button', 'ask-search');
    const trust: boolean[] = [];
    button.addEventListener('pointerdown', (event) => trust.push(event.isTrusted));
    pressElement(button);
    expect(trust).toEqual([false]);
  });
});

describe('runDemo', () => {
  it('glides to the target, then clicks it, then pauses out the step', async () => {
    const button = addElement('button', 'domain-shopping');
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    const onPointerMove = vi.fn();

    const result = run([{ kind: 'click', target: 'domain-shopping', durationMs: 1000 }], { onPointerMove });
    await vi.advanceTimersByTimeAsync(0);
    expect(onPointerMove).toHaveBeenCalledWith('domain-shopping');
    expect(onClick).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(POINTER_MOVE_MS);
    expect(onClick).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1000 - POINTER_MOVE_MS);
    await expect(result).resolves.toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('types into the field one key at a time through input events React can see', async () => {
    const field = addElement('textarea', 'ask-input');
    const inputs: string[] = [];
    field.addEventListener('input', (event) => inputs.push((event as InputEvent).data ?? ''));

    const result = run([{ kind: 'type', target: 'ask-input', text: 'Hi!', durationMs: 2000 }]);
    await vi.advanceTimersByTimeAsync(POINTER_MOVE_MS);
    expect(field.value).toBe('H');
    expect(document.activeElement).toBe(field);
    await vi.advanceTimersByTimeAsync(typingDelaysMs('Hi!')[0]);
    expect(field.value).toBe('Hi');

    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toBe('done');
    expect(field.value).toBe('Hi!');
    expect(inputs).toEqual(['H', 'i', '!']);
  });

  it('pastes the whole text in one input event', async () => {
    const field = addElement('input', 'connect-provider-key');
    const inputTypes: string[] = [];
    field.addEventListener('input', (event) => inputTypes.push((event as InputEvent).inputType));

    const result = run([{ kind: 'paste', target: 'connect-provider-key', text: 'sk-demo', durationMs: 1000 }]);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe('done');
    expect(field.value).toBe('sk-demo');
    expect(inputTypes).toEqual(['insertFromPaste']);
  });

  it('waits for a target that renders later, such as a menu item', async () => {
    const onClick = vi.fn();
    const result = run([{ kind: 'click', target: 'scenario-shopping.place-order', durationMs: 1000 }]);

    await vi.advanceTimersByTimeAsync(300);
    addElement('button', 'scenario-shopping.place-order').addEventListener('click', onClick);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe('done');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('fails with the missing target when it never renders', async () => {
    const result = run([{ kind: 'click', target: 'connect-open', durationMs: 1000 }]);
    const assertion = expect(result).rejects.toThrow(DemoTargetMissingError);

    await vi.advanceTimersByTimeAsync(TARGET_TIMEOUT_MS + 100);
    await assertion;
    await expect(result).rejects.toThrow('connect-open');
  });

  it('finishes in a quarter of the time at speed 4', async () => {
    addElement('button', 'ask-search');
    let outcome: string | undefined;
    void run(
      [{ kind: 'click', target: 'ask-search', durationMs: 1000 }, { kind: 'wait', durationMs: 2000 }],
      { speed: 4 },
    ).then((value) => { outcome = value; });

    await vi.advanceTimersByTimeAsync(749);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toBe('done');
  });

  it('reports each step before it runs', async () => {
    const onStepStart = vi.fn();
    const script: DemoStep[] = [{ kind: 'wait', durationMs: 10 }, { kind: 'wait', durationMs: 10, caption: 'Two' }];
    const result = run(script, { onStepStart });
    await vi.runAllTimersAsync();
    await result;
    expect(onStepStart.mock.calls).toEqual([[script[0], 0], [script[1], 1]]);
  });

  it('stops on abort mid-type: no later key and no pending timer', async () => {
    const field = addElement('textarea', 'ask-input');
    const controller = new AbortController();
    const result = run([{ kind: 'type', target: 'ask-input', text: 'hello', durationMs: 2000 }], { signal: controller.signal });

    await vi.advanceTimersByTimeAsync(POINTER_MOVE_MS + typingDelaysMs('hello')[0]);
    controller.abort();

    await expect(result).resolves.toBe('aborted');
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(field.value).toBe('he');
  });

  it('presses nothing when the signal is already aborted', async () => {
    const onClick = vi.fn();
    addElement('button', 'ask-search').addEventListener('click', onClick);
    const controller = new AbortController();
    controller.abort();

    await expect(run([{ kind: 'click', target: 'ask-search', durationMs: 100 }], { signal: controller.signal })).resolves.toBe('aborted');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('rejects a non-positive speed', async () => {
    await expect(run([{ kind: 'wait', durationMs: 10 }], { speed: 0 })).rejects.toThrow(RangeError);
  });
});

describe('abortOnTrustedInput', () => {
  it('aborts on a trusted pointerdown or keydown', () => {
    for (const eventType of ['pointerdown', 'keydown']) {
      const controller = new AbortController();
      const target = fakeInputTarget();
      abortOnTrustedInput(controller, target);
      target.fire(eventType, true);
      expect(controller.signal.aborted).toBe(true);
    }
  });

  it('ignores the runner’s own untrusted presses', () => {
    const controller = new AbortController();
    const cleanup = abortOnTrustedInput(controller);
    pressElement(addElement('button', 'ask-search'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(controller.signal.aborted).toBe(false);
    cleanup();
  });

  it('stops listening after cleanup', () => {
    const controller = new AbortController();
    const target = fakeInputTarget();
    const cleanup = abortOnTrustedInput(controller, target);
    cleanup();
    expect(target.listenerCount()).toBe(0);
    target.fire('pointerdown', true);
    expect(controller.signal.aborted).toBe(false);
  });
});
