import type { Viewport } from './dot-grid';

export const LOD_ZOOM = 0.3;
export const THUMB_WIDTH = 160;

export const lodWanted = (zoom: number) => zoom < LOD_ZOOM;
export const LOD_SETTLE_MS = 150;

export type PlacedNode = { id: string; x: number; y: number; w: number; h: number };
export type ScreenRect = { id: string; x: number; y: number; w: number; h: number };

export function posterRects(nodes: PlacedNode[], view: Viewport, screen: { width: number; height: number }, posters: Set<string>): ScreenRect[] {
  const rects: ScreenRect[] = [];
  for (const node of nodes) {
    if (!posters.has(node.id)) {
      continue;
    }
    const rect = { id: node.id, x: node.x * view.zoom + view.x, y: node.y * view.zoom + view.y, w: node.w * view.zoom, h: node.h * view.zoom };
    if (rect.x > screen.width || rect.y > screen.height || rect.x + rect.w < 0 || rect.y + rect.h < 0) {
      continue;
    }
    rects.push(rect);
  }
  return rects;
}

export const LOD_CLASS = 'poster-lod';
export const POSTER_CLASS = 'has-poster';
