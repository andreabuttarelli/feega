import type { Viewport } from '../dot-grid';

export type Point = { x: number; y: number };
export type Rect = { id: string; x: number; y: number; w: number; h: number };
export type Screen = { width: number; height: number };

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;

export const toWorld = (view: Viewport, p: Point): Point => ({ x: (p.x - view.x) / view.zoom, y: (p.y - view.y) / view.zoom });

export function zoomAt(view: Viewport, cursor: Point, factor: number): Viewport {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
  const world = toWorld(view, cursor);
  return { x: cursor.x - world.x * zoom, y: cursor.y - world.y * zoom, zoom };
}

export const panBy = (view: Viewport, d: Point): Viewport => ({ x: view.x + d.x, y: view.y + d.y, zoom: view.zoom });

const inside = (r: Rect, p: Point) => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;

export function hitTop(rects: Rect[], p: Point): Rect | null {
  for (let i = rects.length - 1; i >= 0; i--) {
    if (inside(rects[i], p)) {
      return rects[i];
    }
  }
  return null;
}

export function visibleIds(rects: Rect[], view: Viewport, screen: Screen): Set<string> {
  const min = toWorld(view, { x: 0, y: 0 });
  const max = toWorld(view, { x: screen.width, y: screen.height });
  const ids = new Set<string>();
  for (const r of rects) {
    if (r.x > max.x || r.y > max.y || r.x + r.w < min.x || r.y + r.h < min.y) {
      continue;
    }
    ids.add(r.id);
  }
  return ids;
}
