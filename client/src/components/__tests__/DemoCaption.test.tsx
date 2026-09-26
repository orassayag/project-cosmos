import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CAPTION_FADE_MS, DemoCaption } from '../DemoCaption';

function captionStrip(): HTMLElement {
  const strip = document.body.querySelector<HTMLElement>('.lc-demo-caption');
  if (!strip) throw new Error('Expected the caption strip to be rendered into <body>');
  return strip;
}

describe('DemoCaption', () => {
  afterEach(() => {
    document.querySelectorAll('.lc-controls').forEach((element) => element.remove());
  });

  it('announces the caption politely with a fade scaled by speed', () => {
    render(<DemoCaption caption="Pick a domain" isVisible speed={4} />);

    const strip = captionStrip();
    expect(strip.getAttribute('aria-live')).toBe('polite');
    expect(strip.dataset.visible).toBe('true');
    expect(strip.textContent).toBe('Pick a domain');
    const text = strip.querySelector<HTMLElement>('.lc-demo-caption-text');
    expect(text?.style.animationDuration).toBe(`${CAPTION_FADE_MS / 4}ms`);
  });

  it('keeps its live region mounted but empty when hidden or without a caption', () => {
    const { rerender } = render(<DemoCaption caption={null} isVisible speed={1} />);
    expect(captionStrip().dataset.visible).toBe('false');
    expect(captionStrip().textContent).toBe('');

    rerender(<DemoCaption caption="Connect Claude" isVisible={false} speed={1} />);
    expect(captionStrip().dataset.visible).toBe('false');
    expect(captionStrip().textContent).toBe('');
  });

  it('lifts itself above the playback controls when they are showing', () => {
    const controls = document.createElement('div');
    controls.className = 'lc-controls';
    controls.getBoundingClientRect = () => ({
      left: 0, top: window.innerHeight - 120, width: 600, height: 100,
      right: 600, bottom: window.innerHeight - 20, x: 0, y: window.innerHeight - 120, toJSON: () => ({}),
    });
    document.body.appendChild(controls);

    render(<DemoCaption caption="Play the order flow" isVisible speed={1} />);

    expect(captionStrip().style.bottom).toBe('132px');
  });
});
