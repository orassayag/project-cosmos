// Shared pan offset for depth-parallax. The map publishes its world-pan
// (view.tx / view.ty, in viewBox units) here on every view change; the
// always-on background starfield reads it each animation frame and shifts
// each star by pan × depth — far stars barely move, near ones move most.
//
// A plain module store (not React state) on purpose: the starfield polls it
// inside its own rAF loop, so coupling it through props/context would force
// a re-render on every pan tick for no benefit.

let panX = 0;
let panY = 0;

export function publishParallaxPan(x: number, y: number): void {
  panX = x;
  panY = y;
}

export function readParallaxPan(): { x: number; y: number } {
  return { x: panX, y: panY };
}
