export enum Anchor {
  TopLeft = 'top-left',
  TopCenter = 'top-center',
  TopRight = 'top-right',
  BottomLeft = 'bottom-left',
  BottomCenter = 'bottom-center',
  BottomRight = 'bottom-right'
}

export type Area = { x: number; y: number; w: number; h: number };
export type BarSize = { w: number; h: number };
export type Point = { x: number; y: number };

enum Column {
  Left = 0,
  Center = 0.5,
  Right = 1
}

enum Row {
  Top = 0,
  Bottom = 1
}

const SAFE_PX = 16;

const ANCHORS: Record<Anchor, { column: Column; row: Row }> = {
  [Anchor.TopLeft]: { column: Column.Left, row: Row.Top },
  [Anchor.TopCenter]: { column: Column.Center, row: Row.Top },
  [Anchor.TopRight]: { column: Column.Right, row: Row.Top },
  [Anchor.BottomLeft]: { column: Column.Left, row: Row.Bottom },
  [Anchor.BottomCenter]: { column: Column.Center, row: Row.Bottom },
  [Anchor.BottomRight]: { column: Column.Right, row: Row.Bottom }
};

const COLUMNS = [Column.Left, Column.Center, Column.Right];

export const DEFAULT_ANCHOR = Anchor.BottomCenter;

export function anchorBox(anchor: Anchor, area: Area, bar: BarSize): Point {
  const { column, row } = ANCHORS[anchor];
  return {
    x: Math.round(area.x + SAFE_PX + column * (area.w - bar.w - 2 * SAFE_PX)),
    y: Math.round(area.y + SAFE_PX + row * (area.h - bar.h - 2 * SAFE_PX))
  };
}

export function nearestAnchor(at: Point, area: Area, bar: BarSize): Anchor {
  const distance = (anchor: Anchor) => {
    const box = anchorBox(anchor, area, bar);
    return Math.hypot(box.x - at.x, box.y - at.y);
  };
  return Object.values(Anchor).reduce((best, anchor) => (distance(anchor) < distance(best) ? anchor : best));
}

const anchorAt = (column: Column, row: Row) => (Object.entries(ANCHORS).find(([, a]) => a.column === column && a.row === row)![0] as Anchor);

const MOVES: Record<string, (column: number, row: Row) => [number, Row]> = {
  ArrowLeft: (c, r) => [Math.max(0, c - 1), r],
  ArrowRight: (c, r) => [Math.min(COLUMNS.length - 1, c + 1), r],
  ArrowUp: (c) => [c, Row.Top],
  ArrowDown: (c) => [c, Row.Bottom]
};

export function nextAnchor(anchor: Anchor, key: string): Anchor {
  const move = MOVES[key];
  if (!move) {
    return anchor;
  }
  const { column, row } = ANCHORS[anchor];
  const [c, r] = move(COLUMNS.indexOf(column), row);
  return anchorAt(COLUMNS[c], r);
}

export const isAnchor = (value: unknown): value is Anchor => Object.values(Anchor).includes(value as Anchor);
