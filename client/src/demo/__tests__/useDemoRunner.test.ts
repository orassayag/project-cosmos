import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DemoActions, DemoScript } from '../types';
import { DEMO_STATE_ATTRIBUTE, useDemoRunner } from '../useDemoRunner';
import { useDemoAiConnection } from '../useDemoAiConnection';

const ACTION_NAMES = [
  'pressIntro', 'pickDomain', 'setQuestion', 'openConnect', 'pickProvider', 'setConnectField',
  'setAiStatus', 'closeConnect', 'setSearchPressed', 'ask', 'playAnswer', 'playScenario',
  'stepBack', 'stepForward', 'openIncident', 'toggleLegend', 'showEndCard',
] as const satisfies readonly (keyof DemoActions)[];

function recordingActions() {
  const calls: (keyof DemoActions)[] = [];
  const actions = Object.fromEntries(
    ACTION_NAMES.map((name) => [name, vi.fn(() => calls.push(name))]),
  ) as unknown as DemoActions;
  return { actions, calls };
}

function fakeInputTarget() {
  const listeners = new Map<string, EventListener>();
  return {
    addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    fire: (type: string, isTrusted: boolean) => listeners.get(type)?.({ type, isTrusted } as Event),
    listenerCount: () => listeners.size,
  };
}

const SCRIPT: DemoScript = [
  { kind: 'pickDomain', domainId: 'shopping', durationMs: 1000, target: 'domain-shopping', caption: 'Shopping' },
  { kind: 'openConnect', durationMs: 1000, target: 'connect-open' },
  { kind: 'connect', durationMs: 1000, caption: 'Connecting' },
  { kind: 'endCard', durationMs: 1000 },
];

function demoState() {
  return document.documentElement.getAttribute(DEMO_STATE_ATTRIBUTE);
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderRunner(script: DemoScript | undefined, speed = 1) {
  const { actions, calls } = recordingActions();
  const inputTarget = fakeInputTarget();
  const onEnd = vi.fn();
  const rendered = renderHook(() => useDemoRunner({ script, speed, actions, onEnd, inputTarget }));
  return { ...rendered, calls, onEnd, inputTarget };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute(DEMO_STATE_ATTRIBUTE);
});

describe('useDemoRunner', () => {
  it('runs the script to the end and marks the document done', async () => {
    const { result, calls, onEnd, inputTarget } = renderRunner(SCRIPT);

    expect(result.current.isActive).toBe(true);
    expect(demoState()).toBe('running');

    await advance(4000);

    expect(calls).toEqual(['pickDomain', 'openConnect', 'setAiStatus', 'setAiStatus', 'showEndCard']);
    expect(demoState()).toBe('done');
    expect(result.current.status).toBe('done');
    expect(result.current.isOverlayVisible).toBe(false);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('done');
    expect(inputTarget.listenerCount()).toBe(0);
  });

  it('keeps the caption and target until a later step replaces them', async () => {
    const { result } = renderRunner(SCRIPT);

    await advance(0);
    expect(result.current).toMatchObject({ caption: 'Shopping', target: 'domain-shopping', isOverlayVisible: true });

    await advance(1000);
    expect(result.current).toMatchObject({ caption: 'Shopping', target: 'connect-open' });

    await advance(1000);
    expect(result.current).toMatchObject({ caption: 'Connecting', target: 'connect-open' });
  });

  it('divides every duration by the speed', async () => {
    const { onEnd } = renderRunner(SCRIPT, 4);

    await advance(999);
    expect(onEnd).not.toHaveBeenCalled();

    await advance(1);
    expect(onEnd).toHaveBeenCalledWith('done');
  });

  it.each(['pointerdown', 'keydown'])('aborts on a trusted %s and calls no later action', async (eventType) => {
    const { result, calls, onEnd, inputTarget } = renderRunner(SCRIPT);
    await advance(1500);

    await act(async () => {
      inputTarget.fire(eventType, true);
    });
    await advance(10_000);

    expect(calls).toEqual(['pickDomain', 'openConnect']);
    expect(demoState()).toBe('aborted');
    expect(result.current.status).toBe('aborted');
    expect(result.current.isOverlayVisible).toBe(false);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('aborted');
    expect(vi.getTimerCount()).toBe(0);
    expect(inputTarget.listenerCount()).toBe(0);
  });

  it('ignores untrusted input', async () => {
    const { calls, onEnd, inputTarget } = renderRunner(SCRIPT);
    await advance(500);

    inputTarget.fire('pointerdown', false);
    inputTarget.fire('keydown', false);
    await advance(3500);

    expect(calls).toHaveLength(5);
    expect(onEnd).toHaveBeenCalledWith('done');
  });

  it('drops the fake AI connection when aborted mid-connect', async () => {
    const inputTarget = fakeInputTarget();
    const { result } = renderHook(() => {
      const demoAi = useDemoAiConnection();
      const { actions } = recordingActions();
      const runner = useDemoRunner({
        script: SCRIPT,
        speed: 1,
        actions: { ...actions, setAiStatus: demoAi.setDemoStatus },
        onEnd: () => demoAi.setDemoStatus('disconnected'),
        inputTarget,
      });
      return { demoAi, runner };
    });

    await advance(2500);
    expect(result.current.demoAi.isConnecting).toBe(true);

    await act(async () => {
      inputTarget.fire('pointerdown', true);
    });

    expect(result.current.runner.status).toBe('aborted');
    expect(result.current.demoAi.status).toBe('disconnected');
    expect(result.current.demoAi.isConnecting).toBe(false);
  });

  it('calls the latest actions after a re-render', async () => {
    const firstActions = recordingActions();
    const latestActions = recordingActions();
    const inputTarget = fakeInputTarget();
    const { rerender } = renderHook(
      ({ actions }) => useDemoRunner({ script: SCRIPT, speed: 1, actions, onEnd: vi.fn(), inputTarget }),
      { initialProps: { actions: firstActions.actions } },
    );
    await advance(0);

    rerender({ actions: latestActions.actions });
    await advance(1000);

    expect(firstActions.calls).toEqual(['pickDomain']);
    expect(latestActions.calls).toEqual(['openConnect']);
  });

  it('does nothing without a script', async () => {
    const { result, calls, inputTarget } = renderRunner(undefined);
    await advance(5000);

    expect(result.current.status).toBe('idle');
    expect(result.current.isActive).toBe(false);
    expect(calls).toEqual([]);
    expect(demoState()).toBeNull();
    expect(inputTarget.addEventListener).not.toHaveBeenCalled();
  });

  it('clears its timers, listeners and document state on unmount', async () => {
    const { unmount, calls, onEnd, inputTarget } = renderRunner(SCRIPT);
    await advance(500);

    unmount();
    await advance(10_000);

    expect(calls).toEqual(['pickDomain']);
    expect(onEnd).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(inputTarget.listenerCount()).toBe(0);
    expect(demoState()).toBeNull();
  });
});
