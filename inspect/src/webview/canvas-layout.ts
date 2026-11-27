import { SIZES, Size } from './sizes';

export const CANVAS_COLUMNS = [Size.Desktop, Size.Tablet, Size.Phone];

export const COLUMN_GAP = 160;
export const ROW_GAP = 240;
export const ROW_HEAD = 240;

export type CanvasExample = { path: string; label: string };

export type CanvasPage = { route: string; dynamic: boolean; examples?: CanvasExample[] };

export type CanvasFrame = { key: string; route: string; size: Size; dynamic: boolean; target: string | null; x: number; y: number; width: number; height: number };

export type CanvasRow = { route: string; dynamic: boolean; example: CanvasExample | null; y: number; height: number };

export type Bounds = { x: number; y: number; width: number; height: number };

const keyOf = (route: string, size: Size) => `${route}::${size}`;

const dimsOf = (size: Size) => ({ width: SIZES[size].width ?? 0, height: SIZES[size].height ?? 0 });

export function layoutCanvas(pages: CanvasPage[], columns: Size[]) {
  const frames: CanvasFrame[] = [];
  const rows: CanvasRow[] = [];
  const tallest = Math.max(0, ...columns.map((size) => dimsOf(size).height));
  let y = 0;

  for (const page of pages) {
    const example = page.dynamic ? (page.examples?.[0] ?? null) : null;
    const target = page.dynamic ? (example?.path ?? null) : page.route;
    let x = 0;
    for (const size of columns) {
      const { width, height } = dimsOf(size);
      frames.push({ key: keyOf(page.route, size), route: page.route, size, dynamic: page.dynamic, target, x, y: y + ROW_HEAD, width, height });
      x += width + COLUMN_GAP;
    }
    rows.push({ route: page.route, dynamic: page.dynamic, example, y, height: ROW_HEAD + tallest });
    y += ROW_HEAD + tallest + ROW_GAP;
  }

  const bounds = frames.length === 0 ? { x: 0, y: 0, width: 0, height: 0 } : { x: 0, y: 0, width: Math.max(...frames.map((f) => f.x + f.width)), height: y - ROW_GAP };

  return { frames, rows, bounds };
}

export const ROW_WIDTH = 2400;
export const FLOW_GAP_X = 120;
export const FLOW_GAP_Y = 160;
export const DEFAULT_CELL = { width: 320, height: 200 };
export const MIN_CELL = { width: 160, height: 80 };
export const MAX_CELL = { width: 1200, height: 900 };

export type CellSize = { width: number; height: number };

export type FlowItem = { key: string; name: string; size?: CellSize };

export type FlowFrame = { key: string; name: string; target: string; x: number; y: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const cellOf = (size: CellSize | undefined): CellSize => (size ? { width: clamp(size.width, MIN_CELL.width, MAX_CELL.width), height: clamp(size.height, MIN_CELL.height, MAX_CELL.height) } : DEFAULT_CELL);

export function layoutFlow(items: FlowItem[], rowWidth: number) {
  const frames: FlowFrame[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  for (const { key, name, size } of items) {
    const cell = cellOf(size);
    if (x > 0 && x + cell.width > rowWidth) {
      y += rowHeight + FLOW_GAP_Y;
      x = 0;
      rowHeight = 0;
    }
    frames.push({ key, name, target: key, x, y, ...cell });
    x += cell.width + FLOW_GAP_X;
    rowHeight = Math.max(rowHeight, cell.height);
  }
  const bounds = frames.length === 0 ? { x: 0, y: 0, width: 0, height: 0 } : { x: 0, y: 0, width: Math.max(...frames.map((f) => f.x + f.width)), height: Math.max(...frames.map((f) => f.y + f.height)) };

  return { frames, bounds };
}
