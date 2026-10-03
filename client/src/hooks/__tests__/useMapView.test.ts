import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMapView } from '../useMapView';

const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 500;

function svgWithLayoutSize(width: number, height: number, renderedScale: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.defineProperty(svg, 'clientWidth', { value: width });
  Object.defineProperty(svg, 'clientHeight', { value: height });
  svg.getBoundingClientRect = () => new DOMRect(0, 0, width * renderedScale, height * renderedScale);
  return svg;
}

describe('useMapView fitTo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('frames from the layout size, ignoring an ancestor transform still scaling the map', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(performance.now() + 10_000);
      return 1;
    });
    const { result } = renderHook(() => useMapView({ worldW: WORLD_WIDTH, worldH: WORLD_HEIGHT }));
    act(() => result.current.bind(svgWithLayoutSize(WORLD_WIDTH, WORLD_HEIGHT, 1.04)));

    act(() => result.current.fitTo({ minX: 0, minY: 0, maxX: WORLD_WIDTH, maxY: WORLD_HEIGHT }));

    const expectedScale = Math.min((WORLD_WIDTH - 120) / WORLD_WIDTH, (WORLD_HEIGHT - 120) / WORLD_HEIGHT) * 0.88;
    expect(result.current.view.scale).toBeCloseTo(expectedScale, 6);
    expect(result.current.view.tx).toBeCloseTo(WORLD_WIDTH / 2 - (WORLD_WIDTH / 2) * expectedScale, 6);
    expect(result.current.view.ty).toBeCloseTo(WORLD_HEIGHT / 2 - (WORLD_HEIGHT / 2) * expectedScale, 6);
  });
});
