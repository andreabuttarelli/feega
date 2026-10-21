import type { Box } from './geometry';

export type Cell = { cx: number; cy: number };

const RATIO_STEPS = [2, 3, 4, 6, 8];
const MAX_RATIO = RATIO_STEPS[RATIO_STEPS.length - 1];
const HYSTERESIS = 1.25;
const CELL_PIXELS = 4096;
const MIN_CELL_CSS = 256;
const VIEW_MARGIN = 0.25;
const EPSILON = 1e-6;

export const cellKey = (c: Cell) => `${c.cx},${c.cy}`;

export function baseRatio(tile: Box, snapshotRatio: number, snapshotEdge: number): number {
  return Math.min(snapshotRatio, snapshotEdge / Math.max(tile.w, tile.h));
}

export function detailRatio(zoom: number, dpr: number, base: number): number | null {
  const wanted = zoom * dpr;
  if (wanted <= base * HYSTERESIS) {
    return null;
  }
  return RATIO_STEPS.find((step) => step >= wanted && step > base * HYSTERESIS) ?? MAX_RATIO;
}

export const cellCss = (ratio: number) => Math.max(MIN_CELL_CSS, Math.floor(CELL_PIXELS / ratio));

export function cellBox(tile: Box, size: number, c: Cell): Box {
  const x = c.cx * size;
  const y = c.cy * size;
  return { x, y, w: Math.min(size, tile.w - x), h: Math.min(size, tile.h - y) };
}

export function neededCells(tile: Box, view: Box, size: number): Cell[] {
  const mx = view.w * VIEW_MARGIN;
  const my = view.h * VIEW_MARGIN;
  const left = Math.max(view.x - mx, tile.x) - tile.x;
  const top = Math.max(view.y - my, tile.y) - tile.y;
  const right = Math.min(view.x + view.w + mx, tile.x + tile.w) - tile.x;
  const bottom = Math.min(view.y + view.h + my, tile.y + tile.h) - tile.y;
  if (right <= left || bottom <= top) {
    return [];
  }
  const cells: Cell[] = [];
  for (let cy = Math.floor(top / size); cy <= Math.floor((bottom - EPSILON) / size); cy++) {
    for (let cx = Math.floor(left / size); cx <= Math.floor((right - EPSILON) / size); cx++) {
      cells.push({ cx, cy });
    }
  }
  return cells;
}

export const cellBytes = (box: Box, ratio: number) => Math.round(box.w * ratio) * Math.round(box.h * ratio) * 4;

const POSTER_SOFTNESS = 1.5;

type Tile = Box & { id: string };

const onScreen = (t: Box, v: Box) => Math.max(0, Math.min(t.x + t.w, v.x + v.w) - Math.max(t.x, v.x)) * Math.max(0, Math.min(t.y + t.h, v.y + v.h) - Math.max(t.y, v.y));

export function softPosters(tiles: readonly Tile[], view: { x: number; y: number; zoom: number }, screen: { width: number; height: number }, dpr: number, posterWidth: number, cap: number): string[] {
  const world = { x: -view.x / view.zoom, y: -view.y / view.zoom, w: screen.width / view.zoom, h: screen.height / view.zoom };
  return tiles
    .filter((t) => (view.zoom * dpr * t.w) / posterWidth > POSTER_SOFTNESS)
    .map((t) => ({ id: t.id, seen: onScreen(t, world) }))
    .filter((t) => t.seen > 0)
    .sort((a, b) => b.seen - a.seen)
    .slice(0, cap)
    .map((t) => t.id);
}
