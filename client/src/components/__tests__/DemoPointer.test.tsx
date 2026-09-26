import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { POINTER_MOVE_MS } from '../../demo/runDemo';
import { DemoPointer, POINTER_PRESS_MS } from '../DemoPointer';

function addTarget(name: string, rect: { left: number; top: number; width: number; height: number }) {
  const element = document.createElement('button');
  element.setAttribute('data-demo-target', name);
  element.getBoundingClientRect = () => ({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect,
  });
  document.body.appendChild(element);
  return element;
}

async function flushFrames() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
}

function pointerPosition(): { x: number; y: number } {
  const match = screen.getByTestId('demo-pointer').style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
  if (!match) throw new Error('The pointer has no translate transform yet.');
  return { x: Number(match[1]), y: Number(match[2]) };
}

describe('DemoPointer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('[data-demo-target]').forEach((element) => element.remove());
  });

  it('comes to rest near the middle of the target, not on its exact centre', async () => {
    addTarget('connect-open', { left: 100, top: 40, width: 80, height: 20 });
    render(<DemoPointer pointer={{ target: 'connect-open', moveId: 1 }} isVisible speed={1} />);
    await flushFrames();

    const { x, y } = pointerPosition();
    expect(screen.getByTestId('demo-pointer').style.visibility).toBe('visible');
    expect(x).toBeGreaterThan(115);
    expect(x).toBeLessThan(165);
    expect(y).toBeGreaterThan(45);
    expect(y).toBeLessThan(55);
    expect({ x, y }).not.toEqual({ x: 140, y: 50 });
  });

  it('is still on its way part-way through the move', async () => {
    addTarget('connect-open', { left: 1500, top: 40, width: 80, height: 20 });
    render(<DemoPointer pointer={{ target: 'connect-open', moveId: 1 }} isVisible speed={1} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(pointerPosition().x).toBeLessThan(1500);
    await flushFrames();
    expect(pointerPosition().x).toBeGreaterThan(1500);
  });

  it('dips and rings as the press lands, timed by speed', async () => {
    addTarget('connect-open', { left: 100, top: 40, width: 80, height: 20 });
    render(<DemoPointer pointer={{ target: 'connect-open', moveId: 1 }} isVisible speed={2} />);
    await flushFrames();

    const ring = screen.getByTestId('demo-pointer').querySelector<HTMLElement>('.lc-demo-pointer-ripple');
    expect(ring?.style.animationDelay).toBe(`${POINTER_MOVE_MS / 2}ms`);
    expect(ring?.style.animationDuration).toBe(`${POINTER_PRESS_MS / 2}ms`);
  });

  it('stays hidden while the target element does not exist', async () => {
    render(<DemoPointer pointer={{ target: 'ask-search', moveId: 2 }} isVisible speed={1} />);
    await flushFrames();

    expect(screen.getByTestId('demo-pointer').style.visibility).toBe('hidden');
  });

  it('stays where it was when a later target is missing', async () => {
    addTarget('ask-input', { left: 0, top: 0, width: 200, height: 40 });
    const { rerender } = render(<DemoPointer pointer={{ target: 'ask-input', moveId: 3 }} isVisible speed={1} />);
    await flushFrames();
    const settled = pointerPosition();
    rerender(<DemoPointer pointer={{ target: 'ask-search', moveId: 4 }} isVisible speed={1} />);
    await flushFrames();

    expect(pointerPosition()).toEqual(settled);
  });

  it('lands on a slightly different spot and presses again when the same target is clicked twice', async () => {
    addTarget('playback-step-back', { left: 0, top: 0, width: 40, height: 40 });
    const { rerender } = render(<DemoPointer pointer={{ target: 'playback-step-back', moveId: 1 }} isVisible speed={1} />);
    await flushFrames();
    const firstSpot = pointerPosition();
    const firstRing = screen.getByTestId('demo-pointer').querySelector('.lc-demo-pointer-ripple');
    rerender(<DemoPointer pointer={{ target: 'playback-step-back', moveId: 2 }} isVisible speed={1} />);
    await flushFrames();

    expect(pointerPosition()).not.toEqual(firstSpot);
    const secondRing = screen.getByTestId('demo-pointer').querySelector('.lc-demo-pointer-ripple');
    expect(secondRing).not.toBeNull();
    expect(secondRing).not.toBe(firstRing);
  });

  it('hides once the overlay is no longer visible', async () => {
    addTarget('ask-input', { left: 0, top: 0, width: 200, height: 40 });
    const { rerender } = render(<DemoPointer pointer={{ target: 'ask-input', moveId: 5 }} isVisible speed={1} />);
    await flushFrames();
    rerender(<DemoPointer pointer={{ target: 'ask-input', moveId: 6 }} isVisible={false} speed={1} />);

    expect(screen.queryByTestId('demo-pointer')).toBeNull();
  });
});
