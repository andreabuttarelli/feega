import type { Mask, Stroke } from '$lib/image-mask';

export const BRUSH_MIN_PX = 4;
export const BRUSH_MAX_PX = 120;
export const BRUSH_DEFAULT_PX = 36;

const MIN_STEP = 0.002;

export type ScreenRect = { left: number; top: number; width: number; height: number };

type Point = [number, number];

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

export function pointOf(screen: { x: number; y: number }, rect: ScreenRect): Point {
  return [clampUnit((screen.x - rect.left) / rect.width), clampUnit((screen.y - rect.top) / rect.height)];
}

export function brushOf(brushPx: number, rect: ScreenRect): number {
  const px = Math.min(BRUSH_MAX_PX, Math.max(BRUSH_MIN_PX, brushPx));
  return px / Math.min(rect.width, rect.height);
}

export function thinned(points: Point[]): Point[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    const last = index === points.length - 1;
    return index === 0 || last || Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= MIN_STEP;
  });
}

export function maskOfStrokes(strokes: Stroke[]): Pick<Mask, 'strokes'> | null {
  return strokes.length ? { strokes } : null;
}
