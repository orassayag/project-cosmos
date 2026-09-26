import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { POINTER_MOVE_MS } from '../../demo/runDemo';
import { DemoPointer, POINTER_RIPPLE_MS } from '../DemoPointer';

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
    await vi.advanceTimersByTimeAsync(100);
  });
}

describe('DemoPointer', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('[data-demo-target]').forEach((element) => element.remove());
  });

  it('glides to the centre of the target element and ripples, with both durations scaled by speed', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    addTarget('connect-open', { left: 100, top: 40, width: 80, height: 20 });
    render(<DemoPointer pointer={{ target: 'connect-open', moveId: 1 }} isVisible speed={2} />);
    await flushFrames();

    const pointer = screen.getByTestId('demo-pointer');
    expect(pointer.style.transform).toBe('translate(140px, 50px)');
    expect(pointer.style.transitionDuration).toBe(`${POINTER_MOVE_MS / 2}ms`);
    const ripple = pointer.querySelector<HTMLElement>('.lc-demo-pointer-ripple');
    expect(ripple?.style.animationDelay).toBe(`${POINTER_MOVE_MS / 2}ms`);
    expect(ripple?.style.animationDuration).toBe(`${POINTER_RIPPLE_MS / 2}ms`);
  });

  it('renders nothing while the target element does not exist', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    render(<DemoPointer pointer={{ target: 'ask-search', moveId: 2 }} isVisible speed={1} />);
    await flushFrames();

    expect(screen.queryByTestId('demo-pointer')).toBeNull();
  });

  it('stays where it was when a later target is missing', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    addTarget('ask-input', { left: 0, top: 0, width: 200, height: 40 });
    const { rerender } = render(<DemoPointer pointer={{ target: 'ask-input', moveId: 3 }} isVisible speed={1} />);
    await flushFrames();
    rerender(<DemoPointer pointer={{ target: 'ask-search', moveId: 4 }} isVisible speed={1} />);
    await flushFrames();

    expect(screen.getByTestId('demo-pointer').style.transform).toBe('translate(100px, 20px)');
  });

  it('ripples again when the same target is pressed twice', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    addTarget('playback-step-back', { left: 0, top: 0, width: 40, height: 40 });
    const { rerender } = render(<DemoPointer pointer={{ target: 'playback-step-back', moveId: 1 }} isVisible speed={1} />);
    await flushFrames();
    const firstRipple = screen.getByTestId('demo-pointer').querySelector('.lc-demo-pointer-ripple');
    rerender(<DemoPointer pointer={{ target: 'playback-step-back', moveId: 2 }} isVisible speed={1} />);
    await flushFrames();

    const secondRipple = screen.getByTestId('demo-pointer').querySelector('.lc-demo-pointer-ripple');
    expect(secondRipple).not.toBeNull();
    expect(secondRipple).not.toBe(firstRipple);
  });

  it('hides once the overlay is no longer visible', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    addTarget('ask-input', { left: 0, top: 0, width: 200, height: 40 });
    const { rerender } = render(<DemoPointer pointer={{ target: 'ask-input', moveId: 5 }} isVisible speed={1} />);
    await flushFrames();
    rerender(<DemoPointer pointer={{ target: 'ask-input', moveId: 6 }} isVisible={false} speed={1} />);

    expect(screen.queryByTestId('demo-pointer')).toBeNull();
  });
});
