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

const SCENE_DOT_RADIUS = 1;
const MIN_TILE_ZOOM = 0.25;

export function dotBackground(view: Viewport): Record<string, string> {
  const scale = Math.max(view.zoom, MIN_TILE_ZOOM);
  const tile = DOT_GAP * scale;
  const radius = SCENE_DOT_RADIUS * scale;
  return {
    'background-image': `radial-gradient(circle, var(--ui-canvas-dot) ${radius}px, transparent ${radius}px)`,
    'background-size': `${tile}px ${tile}px`,
    'background-position': `${view.x % tile}px ${view.y % tile}px`
  };
}
