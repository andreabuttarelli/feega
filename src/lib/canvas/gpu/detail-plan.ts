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
