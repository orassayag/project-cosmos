import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DemoPointer, POINTER_MOVE_MS, POINTER_RIPPLE_MS } from '../DemoPointer';

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
    render(<DemoPointer target="connect-open" isVisible speed={2} />);
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
    render(<DemoPointer target="ask-search" isVisible speed={1} />);
    await flushFrames();

    expect(screen.queryByTestId('demo-pointer')).toBeNull();
  });

  it('stays where it was when a later target is missing', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    addTarget('ask-input', { left: 0, top: 0, width: 200, height: 40 });
    const { rerender } = render(<DemoPointer target="ask-input" isVisible speed={1} />);
    await flushFrames();
    rerender(<DemoPointer target="ask-search" isVisible speed={1} />);
    await flushFrames();

    expect(screen.getByTestId('demo-pointer').style.transform).toBe('translate(100px, 20px)');
  });

  it('hides once the overlay is no longer visible', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    addTarget('ask-input', { left: 0, top: 0, width: 200, height: 40 });
    const { rerender } = render(<DemoPointer target="ask-input" isVisible speed={1} />);
    await flushFrames();
    rerender(<DemoPointer target="ask-input" isVisible={false} speed={1} />);

    expect(screen.queryByTestId('demo-pointer')).toBeNull();
  });
});
