import type { Outline, Pt } from './shape/geometry';

export enum DrawTool {
  Select = 'select',
  Text = 'text',
  Rectangle = 'rectangle',
  Ellipse = 'ellipse',
  Pen = 'pen'
}

export type DragPoint = { x: number; y: number };
export type DrawBox = { x: number; y: number; width: number; height: number };

const MIN_SIZE = 0.001;
const PRECISION = 10000;
const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

export function dragRect(from: DragPoint, to: DragPoint, lockRatio: boolean): DrawBox | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const side = lockRatio ? Math.max(Math.abs(dx), Math.abs(dy)) : null;
  const width = side ?? Math.abs(dx);
  const height = side ?? Math.abs(dy);
  if (width < MIN_SIZE || height < MIN_SIZE) {
    return null;
  }
  const endX = from.x + Math.sign(dx || 1) * width;
  const endY = from.y + Math.sign(dy || 1) * height;
  return { x: round((from.x + endX) / 2), y: round((from.y + endY) / 2), width: round(width), height: round(height) };
}

export enum Corner {
  NW = 'nw',
  NE = 'ne',
  SW = 'sw',
  SE = 'se'
}

const CORNER_ANCHOR: Record<Corner, (box: DrawBox) => DragPoint> = {
  [Corner.NW]: (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }),
  [Corner.NE]: (box) => ({ x: box.x - box.width / 2, y: box.y + box.height / 2 }),
  [Corner.SW]: (box) => ({ x: box.x + box.width / 2, y: box.y - box.height / 2 }),
  [Corner.SE]: (box) => ({ x: box.x - box.width / 2, y: box.y - box.height / 2 })
};

export function resizeFromCorner(box: DrawBox, corner: Corner, to: DragPoint, lockRatio: boolean): DrawBox | null {
  return dragRect(CORNER_ANCHOR[corner](box), to, lockRatio);
}

export function roundnessFromInset(box: Pick<DrawBox, 'width' | 'height'>, insetNormalized: number): number {
  const short = Math.min(box.width, box.height);
  if (short <= 0) {
    return 0;
  }
  return Math.min(Math.max(insetNormalized / short, 0), 0.5);
}

export function nudge(box: DrawBox, dx: number, dy: number): DrawBox {
  return { ...box, x: box.x + dx, y: box.y + dy };
}

const MIN_CLOSING_POINTS = 3;

export function closesOnFirst(outline: Outline, at: Pt, reach: number): boolean {
  const last = outline[outline.length - 1];
  if (!last || last.closed || last.vertices.length < MIN_CLOSING_POINTS) {
    return false;
  }
  const [x, y] = last.vertices[0].p;
  return Math.hypot(at[0] - x, at[1] - y) <= reach;
}
