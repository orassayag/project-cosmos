import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abortOnTrustedInput, runDemo, scaledDuration, SEARCH_PRESS_MS, sleep } from '../runDemo';
import { DEMO_STEP_ACTIONS, DEMO_STEP_KINDS, type DemoActions, type DemoStep, type DemoStepKind } from '../types';

const ACTION_NAMES = [
  'pressIntro', 'pickDomain', 'setQuestion', 'openConnect', 'pickProvider', 'setConnectField',
  'setAiStatus', 'closeConnect', 'setSearchPressed', 'ask', 'playAnswer', 'playScenario',
  'stepBack', 'stepForward', 'openIncident', 'toggleLegend', 'showEndCard',
] as const satisfies readonly (keyof DemoActions)[];

function recordingActions() {
  const calls: { name: keyof DemoActions; args: unknown[] }[] = [];
  const actions = Object.fromEntries(
    ACTION_NAMES.map((name) => [name, vi.fn((...args: unknown[]) => calls.push({ name, args }))]),
  ) as unknown as DemoActions;
  return { actions, calls, names: () => calls.map((call) => call.name) };
}

const SAMPLE_STEPS: Record<DemoStepKind, DemoStep> = {
  pressIntro: { kind: 'pressIntro', durationMs: 100 },
  pickDomain: { kind: 'pickDomain', domainId: 'shopping', durationMs: 100 },
  type: { kind: 'type', text: 'Where do orders go?', durationMs: 100 },
  openConnect: { kind: 'openConnect', durationMs: 100 },
  pickProvider: { kind: 'pickProvider', provider: 'anthropic', durationMs: 100 },
  paste: { kind: 'paste', field: 'providerKey', value: 'demo-key', durationMs: 100 },
  connect: { kind: 'connect', durationMs: 400 },
  closeConnect: { kind: 'closeConnect', durationMs: 100 },
  ask: { kind: 'ask', question: 'Where do orders go?', durationMs: 400 },
  answer: { kind: 'answer', answer: { text: 'To checkout.', thinkingMs: 10, wordMs: 5 }, durationMs: 100 },
  playScenario: { kind: 'playScenario', scenarioId: 'checkout', durationMs: 100 },
  stepBack: { kind: 'stepBack', durationMs: 100 },
  stepForward: { kind: 'stepForward', durationMs: 100 },
  openIncident: { kind: 'openIncident', incidentId: 'incident-1', durationMs: 100 },
  toggleLegend: { kind: 'toggleLegend', isVisible: true, durationMs: 100 },
  wait: { kind: 'wait', durationMs: 100 },
  endCard: { kind: 'endCard', durationMs: 100 },
};

const THREE_STEP_SCRIPT: DemoStep[] = [
  { kind: 'pickDomain', domainId: 'shopping', durationMs: 1000 },
  { kind: 'type', text: 'hello', durationMs: 1000 },
  { kind: 'endCard', durationMs: 1000 },
];

function fakeInputTarget() {
  const listeners = new Map<string, EventListener>();
  return {
    addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    fire: (type: string, isTrusted: boolean) => listeners.get(type)?.({ type, isTrusted } as Event),
    listenerCount: () => listeners.size,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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

  it('removes its abort listener once it resolves', async () => {
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
    const promise = sleep(10, controller.signal);
    await vi.advanceTimersByTimeAsync(10);
    await promise;
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});

describe('scaledDuration', () => {
  it('divides the duration by the speed', () => {
    expect(scaledDuration(1000, 4)).toBe(250);
    expect(scaledDuration(1000, 1)).toBe(1000);
  });
});

describe('runDemo', () => {
  it('calls actions in script order, one step per duration', async () => {
    const { actions, names } = recordingActions();
    const run = runDemo(THREE_STEP_SCRIPT, actions, { signal: new AbortController().signal, speed: 1 });

    await vi.advanceTimersByTimeAsync(0);
    expect(names()).toEqual(['pickDomain']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(names()).toEqual(['pickDomain', 'setQuestion']);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(run).resolves.toBe('done');
    expect(names()).toEqual(['pickDomain', 'setQuestion', 'showEndCard']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drives each step kind through the callbacks mapped in DEMO_STEP_ACTIONS', async () => {
    for (const kind of DEMO_STEP_KINDS) {
      const { actions, names } = recordingActions();
      const run = runDemo([SAMPLE_STEPS[kind]], actions, { signal: new AbortController().signal, speed: 1 });
      await vi.runAllTimersAsync();
      await expect(run).resolves.toBe('done');
      expect([...new Set(names())].sort()).toEqual([...DEMO_STEP_ACTIONS[kind]].sort());
    }
  });

  it('moves the fake connection from connecting to connected within the step duration', async () => {
    const { actions, calls } = recordingActions();
    const run = runDemo([SAMPLE_STEPS.connect], actions, { signal: new AbortController().signal, speed: 1 });

    await vi.advanceTimersByTimeAsync(399);
    expect(calls.map((call) => call.args)).toEqual([['connecting']]);
    await vi.advanceTimersByTimeAsync(1);
    await expect(run).resolves.toBe('done');
    expect(calls.map((call) => call.args)).toEqual([['connecting'], ['connected']]);
  });

  it('presses and releases search before asking, keeping the total step duration', async () => {
    const { actions, calls } = recordingActions();
    const run = runDemo([SAMPLE_STEPS.ask], actions, { signal: new AbortController().signal, speed: 1 });

    await vi.advanceTimersByTimeAsync(SEARCH_PRESS_MS);
    expect(calls).toEqual([
      { name: 'setSearchPressed', args: [true] },
      { name: 'setSearchPressed', args: [false] },
      { name: 'ask', args: ['Where do orders go?'] },
    ]);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(400 - SEARCH_PRESS_MS);
    await expect(run).resolves.toBe('done');
  });

  it('finishes in a quarter of the time at speed 4', async () => {
    const { actions } = recordingActions();
    let result: string | undefined;
    void runDemo(THREE_STEP_SCRIPT, actions, { signal: new AbortController().signal, speed: 4 }).then((value) => {
      result = value;
    });

    await vi.advanceTimersByTimeAsync(749);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBe('done');
  });

  it('reports each step before its actions run', async () => {
    const { actions, names } = recordingActions();
    const seen: string[] = [];
    const onStepStart = vi.fn((step: DemoStep, stepIndex: number) => {
      seen.push(`${stepIndex}:${step.kind}:${names().length}`);
    });
    const run = runDemo(THREE_STEP_SCRIPT, actions, { signal: new AbortController().signal, speed: 1, onStepStart });
    await vi.runAllTimersAsync();
    await run;
    expect(seen).toEqual(['0:pickDomain:0', '1:type:1', '2:endCard:2']);
  });

  it('stops on abort mid-run: no later action and no pending timer', async () => {
    const { actions, names } = recordingActions();
    const controller = new AbortController();
    const run = runDemo(THREE_STEP_SCRIPT, actions, { signal: controller.signal, speed: 1 });

    await vi.advanceTimersByTimeAsync(1500);
    controller.abort();

    await expect(run).resolves.toBe('aborted');
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(names()).toEqual(['pickDomain', 'setQuestion']);
  });

  it('calls no action when the signal is already aborted', async () => {
    const { actions, names } = recordingActions();
    const controller = new AbortController();
    controller.abort();
    const onStepStart = vi.fn();

    await expect(runDemo(THREE_STEP_SCRIPT, actions, { signal: controller.signal, speed: 1, onStepStart })).resolves.toBe(
      'aborted',
    );
    expect(names()).toEqual([]);
    expect(onStepStart).not.toHaveBeenCalled();
  });

  it('rejects a non-positive speed', async () => {
    const { actions } = recordingActions();
    await expect(runDemo(THREE_STEP_SCRIPT, actions, { signal: new AbortController().signal, speed: 0 })).rejects.toThrow(
      RangeError,
    );
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

  it('ignores untrusted events', () => {
    const controller = new AbortController();
    const target = fakeInputTarget();
    abortOnTrustedInput(controller, target);
    target.fire('pointerdown', false);
    target.fire('keydown', false);
    expect(controller.signal.aborted).toBe(false);
  });

  it('ignores a synthetic event dispatched on window', () => {
    const controller = new AbortController();
    const cleanup = abortOnTrustedInput(controller);
    window.dispatchEvent(new Event('pointerdown'));
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

  it('a trusted pointerdown aborts a running demo', async () => {
    const { actions, names } = recordingActions();
    const controller = new AbortController();
    const target = fakeInputTarget();
    const cleanup = abortOnTrustedInput(controller, target);
    const run = runDemo(THREE_STEP_SCRIPT, actions, { signal: controller.signal, speed: 1 });

    await vi.advanceTimersByTimeAsync(500);
    target.fire('pointerdown', true);

    await expect(run).resolves.toBe('aborted');
    expect(names()).toEqual(['pickDomain']);
    expect(vi.getTimerCount()).toBe(0);
    cleanup();
  });
});
