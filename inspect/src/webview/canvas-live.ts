import type { CanvasFrame } from './canvas-layout';
import type { CanvasView, Viewport } from './canvas-view';

export const LIVE_CAP = 6;
export const VISIBLE_MARGIN = 200;
export const MIN_LIVE_WIDTH = 240;
export const STICKY_MARGIN = 300;

type Placed = Pick<CanvasFrame, 'key' | 'dynamic' | 'x' | 'y' | 'width' | 'height'>;

const touches = (f: Placed, view: CanvasView, viewport: Viewport, margin: number) => {
  const left = f.x * view.scale + view.x;
  const top = f.y * view.scale + view.y;

  return left < viewport.w + margin && left + f.width * view.scale > -margin && top < viewport.h + margin && top + f.height * view.scale > -margin;
};

export const visibleKeys = (frames: Placed[], view: CanvasView, viewport: Viewport, margin: number): string[] => frames.filter((f) => touches(f, view, viewport, margin)).map((f) => f.key);

const gapToCentre = (f: Placed, view: CanvasView, viewport: Viewport) => Math.hypot(view.x + (f.x + f.width / 2) * view.scale - viewport.w / 2, view.y + (f.y + f.height / 2) * view.scale - viewport.h / 2);

const STICKY_PULL = 400;

export function liveSet(frames: Placed[], view: CanvasView, viewport: Viewport, current: string[], minWidth = MIN_LIVE_WIDTH): string[] {
  const held = (f: Placed) => current.includes(f.key);
  const rank = (f: Placed) => gapToCentre(f, view, viewport) - (held(f) ? STICKY_PULL : 0);

  return frames
    .filter((f) => !f.dynamic && f.width * view.scale >= minWidth && touches(f, view, viewport, VISIBLE_MARGIN + (held(f) ? STICKY_MARGIN : 0)))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, LIVE_CAP)
    .map((f) => f.key);
}
