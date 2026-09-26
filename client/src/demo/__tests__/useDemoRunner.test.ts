import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { POINTER_MOVE_MS, TARGET_TIMEOUT_MS } from '../runDemo';
import type { DemoScript } from '../types';
import { DEMO_ERROR_ATTRIBUTE, DEMO_STATE_ATTRIBUTE, useDemoRunner } from '../useDemoRunner';

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
  { kind: 'click', target: 'domain-shopping', durationMs: 1000, caption: 'Shopping' },
  { kind: 'click', target: 'connect-open', durationMs: 1000 },
  { kind: 'click', target: 'connect-open', durationMs: 1000, caption: 'Again' },
  { kind: 'wait', durationMs: 1000 },
];

let clicks: string[] = [];

function addButton(target: string) {
  const button = document.createElement('button');
  button.setAttribute('data-demo-target', target);
  button.addEventListener('click', () => clicks.push(target));
  document.body.appendChild(button);
}

function demoState() {
  return document.documentElement.getAttribute(DEMO_STATE_ATTRIBUTE);
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderRunner(script: DemoScript | undefined, speed = 1) {
  const inputTarget = fakeInputTarget();
  const onEnd = vi.fn();
  const rendered = renderHook(() => useDemoRunner({ script, speed, onEnd, inputTarget }));
  return { ...rendered, onEnd, inputTarget };
}

beforeEach(() => {
  vi.useFakeTimers();
  clicks = [];
  addButton('domain-shopping');
  addButton('connect-open');
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.documentElement.removeAttribute(DEMO_STATE_ATTRIBUTE);
  document.documentElement.removeAttribute(DEMO_ERROR_ATTRIBUTE);
});

describe('useDemoRunner', () => {
  it('clicks through the script and marks the document done', async () => {
    const { result, onEnd, inputTarget } = renderRunner(SCRIPT);

    expect(result.current.isActive).toBe(true);
    expect(demoState()).toBe('running');

    await advance(4000);

    expect(clicks).toEqual(['domain-shopping', 'connect-open', 'connect-open']);
    expect(demoState()).toBe('done');
    expect(result.current.status).toBe('done');
    expect(result.current.isOverlayVisible).toBe(false);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('done');
    expect(inputTarget.listenerCount()).toBe(0);
  });

  it('moves the pointer on every press, even to the same target twice', async () => {
    const { result } = renderRunner(SCRIPT);

    await advance(0);
    expect(result.current).toMatchObject({ caption: 'Shopping', pointer: { target: 'domain-shopping', moveId: 1 } });

    await advance(1000);
    expect(result.current).toMatchObject({ caption: 'Shopping', pointer: { target: 'connect-open', moveId: 2 } });

    await advance(1000);
    expect(result.current).toMatchObject({ caption: 'Again', pointer: { target: 'connect-open', moveId: 3 } });
  });

  it('divides every duration by the speed', async () => {
    const { onEnd } = renderRunner(SCRIPT, 4);

    await advance(999);
    expect(onEnd).not.toHaveBeenCalled();

    await advance(1);
    expect(onEnd).toHaveBeenCalledWith('done');
  });

  it.each(['pointerdown', 'keydown'])('aborts on a trusted %s and presses nothing more', async (eventType) => {
    const { result, onEnd, inputTarget } = renderRunner(SCRIPT);
    await advance(1000 + POINTER_MOVE_MS / 2);

    await act(async () => {
      inputTarget.fire(eventType, true);
    });
    await advance(10_000);

    expect(clicks).toEqual(['domain-shopping']);
    expect(demoState()).toBe('aborted');
    expect(result.current.status).toBe('aborted');
    expect(result.current.isOverlayVisible).toBe(false);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('aborted');
    expect(vi.getTimerCount()).toBe(0);
    expect(inputTarget.listenerCount()).toBe(0);
  });

  it('fails with the reason on the document when a target never shows', async () => {
    const { result, onEnd } = renderRunner([{ kind: 'click', target: 'menu-open', durationMs: 500 }]);

    await advance(TARGET_TIMEOUT_MS + 100);

    expect(result.current.status).toBe('failed');
    expect(demoState()).toBe('failed');
    expect(document.documentElement.getAttribute(DEMO_ERROR_ATTRIBUTE)).toContain('menu-open');
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('failed');
  });

  it('does nothing without a script', async () => {
    const { result, inputTarget } = renderRunner(undefined);
    await advance(5000);

    expect(result.current.status).toBe('idle');
    expect(result.current.isActive).toBe(false);
    expect(clicks).toEqual([]);
    expect(demoState()).toBeNull();
    expect(inputTarget.addEventListener).not.toHaveBeenCalled();
  });

  it('clears its timers, listeners and document state on unmount', async () => {
    const { unmount, onEnd, inputTarget } = renderRunner(SCRIPT);
    await advance(POINTER_MOVE_MS + 100);

    unmount();
    await advance(10_000);

    expect(clicks).toEqual(['domain-shopping']);
    expect(onEnd).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(inputTarget.listenerCount()).toBe(0);
    expect(demoState()).toBeNull();
  });
});
