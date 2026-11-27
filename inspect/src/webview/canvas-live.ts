import type { CanvasFrame } from './canvas-layout';
import type { CanvasView, Viewport } from './canvas-view';

export const LIVE_CAP = 6;
export const VISIBLE_MARGIN = 200;

const touches = (f: CanvasFrame, view: CanvasView, viewport: Viewport, margin: number) => {
  const left = f.x * view.scale + view.x;
  const top = f.y * view.scale + view.y;

  return left < viewport.w + margin && left + f.width * view.scale > -margin && top < viewport.h + margin && top + f.height * view.scale > -margin;
};

export const visibleKeys = (frames: CanvasFrame[], view: CanvasView, viewport: Viewport, margin: number): string[] => frames.filter((f) => touches(f, view, viewport, margin)).map((f) => f.key);

const gapToCentre = (f: CanvasFrame, view: CanvasView, viewport: Viewport) => Math.hypot(view.x + (f.x + f.width / 2) * view.scale - viewport.w / 2, view.y + (f.y + f.height / 2) * view.scale - viewport.h / 2);

export function liveKeys(frames: CanvasFrame[], view: CanvasView, viewport: Viewport, margin: number, cap: number): string[] {
  return frames
    .filter((f) => f.target !== null && touches(f, view, viewport, margin))
    .sort((a, b) => gapToCentre(a, view, viewport) - gapToCentre(b, view, viewport))
    .slice(0, cap)
    .map((f) => f.key);
}

export const leaving = (was: string[], now: string[]): string[] => was.filter((key) => !now.includes(key));
