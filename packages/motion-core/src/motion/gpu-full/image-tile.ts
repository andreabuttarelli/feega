import type { Rect, Size } from './image-rect';

export const MAX_TILES = 2500;
const TILE_SHARE = 0.25;
const DEG = Math.PI / 180;

export type Tiling = { scale: number; rotation: number; focus: [number, number] };

function reach(box: Size, rotation: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const cx = box.width / 2;
  const cy = box.height / 2;
  const cos = Math.cos(-rotation * DEG);
  const sin = Math.sin(-rotation * DEG);
  const corners = [
    [0, 0],
    [box.width, 0],
    [0, box.height],
    [box.width, box.height]
  ].map(([x, y]) => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function tileCells(box: Size, natural: Size, { scale, rotation, focus }: Tiling): Rect[] {
  const width = box.width * scale * TILE_SHARE;
  const height = (width * natural.height) / natural.width;
  const originX = (box.width - width) * focus[0];
  const originY = (box.height - height) * focus[1];
  const span = reach(box, rotation);
  const startX = originX + Math.floor((span.minX - originX) / width) * width;
  const startY = originY + Math.floor((span.minY - originY) / height) * height;
  const cells: Rect[] = [];
  for (let y = startY; y < span.maxY; y += height) {
    for (let x = startX; x < span.maxX; x += width) {
      if (cells.length === MAX_TILES) {
        return cells;
      }
      cells.push({ x, y, width, height });
    }
  }
  return cells;
}
