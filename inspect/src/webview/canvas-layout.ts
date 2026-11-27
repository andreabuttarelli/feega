import { SIZES, Size } from './sizes';

export const CANVAS_COLUMNS = [Size.Desktop, Size.Tablet, Size.Phone];

export const COLUMN_GAP = 160;
export const ROW_GAP = 240;
export const ROW_HEAD = 240;

export type CanvasPage = { route: string; dynamic: boolean };

export type CanvasFrame = { key: string; route: string; size: Size; dynamic: boolean; x: number; y: number; width: number; height: number };

export type CanvasRow = { route: string; dynamic: boolean; y: number; height: number };

export type Bounds = { x: number; y: number; width: number; height: number };

const keyOf = (route: string, size: Size) => `${route}::${size}`;

const dimsOf = (size: Size) => ({ width: SIZES[size].width ?? 0, height: SIZES[size].height ?? 0 });

export function layoutCanvas(pages: CanvasPage[], columns: Size[]) {
  const frames: CanvasFrame[] = [];
  const rows: CanvasRow[] = [];
  const tallest = Math.max(0, ...columns.map((size) => dimsOf(size).height));
  let y = 0;

  for (const page of pages) {
    let x = 0;
    for (const size of columns) {
      const { width, height } = dimsOf(size);
      frames.push({ key: keyOf(page.route, size), route: page.route, size, dynamic: page.dynamic, x, y: y + ROW_HEAD, width, height });
      x += width + COLUMN_GAP;
    }
    rows.push({ route: page.route, dynamic: page.dynamic, y, height: ROW_HEAD + tallest });
    y += ROW_HEAD + tallest + ROW_GAP;
  }

  const bounds = frames.length === 0 ? { x: 0, y: 0, width: 0, height: 0 } : { x: 0, y: 0, width: Math.max(...frames.map((f) => f.x + f.width)), height: y - ROW_GAP };

  return { frames, rows, bounds };
}
