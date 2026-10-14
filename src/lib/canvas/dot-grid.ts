export type Viewport = { x: number; y: number; zoom: number };
export type DotGrid = { first: { x: number; y: number }; step: number; radius: number };

export const DOT_GAP = 24;
const DOT_SIZE = 1;
const MIN_VISIBLE_STEP = 6;

function firstAt(offset: number, step: number): number {
  return ((offset % step) + step) % step;
}

export function dotGrid(view: Viewport, gap = DOT_GAP): DotGrid | null {
  const step = gap * view.zoom;
  if (step < MIN_VISIBLE_STEP) {
    return null;
  }

  return { first: { x: firstAt(view.x, step), y: firstAt(view.y, step) }, step, radius: (DOT_SIZE * view.zoom) / 2 };
}
