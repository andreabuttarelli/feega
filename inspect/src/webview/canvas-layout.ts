import { SIZES, Size } from './sizes';

export const CANVAS_COLUMNS = [Size.Desktop, Size.Tablet, Size.Phone];

export const COLUMN_GAP = 160;
export const ROW_GAP = 240;
export const ROW_HEAD = 280;

export type CanvasExample = { path: string; label: string };

export type CanvasPage = { route: string; dynamic: boolean; examples?: CanvasExample[] };

export type CanvasFrame = { key: string; route: string; size: Size; dynamic: boolean; target: string | null; x: number; y: number; width: number; height: number; pageHeight: number };

export type CanvasRow = { route: string; dynamic: boolean; example: CanvasExample | null; x: number; y: number; height: number };

export type Bounds = { x: number; y: number; width: number; height: number };

const keyOf = (route: string, size: Size) => `${route}::${size}`;

const dimsOf = (size: Size) => ({ width: SIZES[size].width ?? 0, height: SIZES[size].height ?? 0 });

export type Heights = Record<string, number>;

export const GROUP_GAP = 320;
export const HEIGHT_CAP_FACTOR = 3;
export const COMPACT_HEIGHT = 480;

export const groupWidth = (columns: Size[]) => columns.reduce((sum, size) => sum + dimsOf(size).width, 0) + COLUMN_GAP * (columns.length - 1);

const rowsOf = (heights: number[], perRow: number) => Array.from({ length: Math.ceil(heights.length / perRow) }, (_, i) => Math.max(...heights.slice(i * perRow, (i + 1) * perRow)));

function fitScale(heights: number[], width: number, perRow: number, viewport: { w: number; h: number }) {
  const rows = rowsOf(heights, perRow);
  const totalWidth = perRow * width + (perRow - 1) * GROUP_GAP;
  const totalHeight = rows.reduce((sum, h) => sum + h, 0) + (rows.length - 1) * ROW_GAP;

  return Math.min(viewport.w / totalWidth, viewport.h / totalHeight);
}

export function columnsFor(groupHeights: number[], width: number, viewport: { w: number; h: number } | null): number {
  if (!viewport || viewport.w <= 0 || viewport.h <= 0 || groupHeights.length === 0) {
    return 1;
  }
  let best = 1;
  let bestScale = fitScale(groupHeights, width, 1, viewport);
  for (let perRow = 2; perRow <= groupHeights.length; perRow++) {
    const scale = fitScale(groupHeights, width, perRow, viewport);
    if (scale > bestScale) {
      best = perRow;
      bestScale = scale;
    }
  }

  return best;
}

function framesOf(page: CanvasPage, columns: Size[], heights: Heights, target: string | null) {
  return columns.map((size) => {
    const key = keyOf(page.route, size);
    const device = dimsOf(size);
    const pageHeight = heights[key] ?? device.height;
    const shown = target === null ? COMPACT_HEIGHT : Math.min(pageHeight, HEIGHT_CAP_FACTOR * device.height);

    return { key, size, width: device.width, height: shown, pageHeight };
  });
}

export function layoutCanvas(pages: CanvasPage[], columns: Size[], heights: Heights = {}, viewport: { w: number; h: number } | null = null) {
  const groups = pages.map((page) => {
    const example = page.dynamic ? (page.examples?.[0] ?? null) : null;
    const target = page.dynamic ? (example?.path ?? null) : page.route;

    return { page, example, target, frames: framesOf(page, columns, heights, target) };
  });
  const tallest = groups.map((g) => Math.max(...g.frames.map((f) => f.height)));
  const perRow = columnsFor(tallest.map((h) => ROW_HEAD + h), groupWidth(columns), viewport);
  const frames: CanvasFrame[] = [];
  const rows: CanvasRow[] = [];
  let y = 0;

  for (let start = 0; start < groups.length; start += perRow) {
    const line = groups.slice(start, start + perRow);
    const height = ROW_HEAD + Math.max(...line.map((_, i) => tallest[start + i]));
    line.forEach(({ page, example, target, frames: shown }, i) => {
      const x = i * (groupWidth(columns) + GROUP_GAP);
      let left = x;
      for (const frame of shown) {
        frames.push({ ...frame, route: page.route, dynamic: page.dynamic, target, x: left, y: y + ROW_HEAD });
        left += frame.width + COLUMN_GAP;
      }
      rows.push({ route: page.route, dynamic: page.dynamic, example, x, y, height });
    });
    y += height + ROW_GAP;
  }

  const bounds = frames.length === 0 ? { x: 0, y: 0, width: 0, height: 0 } : { x: 0, y: 0, width: Math.max(...frames.map((f) => f.x + f.width)), height: Math.max(...frames.map((f) => f.y + f.height)) };

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
