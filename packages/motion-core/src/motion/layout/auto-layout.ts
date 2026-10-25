import type { Box } from '../layout';

export enum Direction {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
  Grid = 'grid'
}

export enum Justify {
  Start = 'start',
  Center = 'center',
  End = 'end',
  SpaceBetween = 'space-between',
  SpaceAround = 'space-around',
  SpaceEvenly = 'space-evenly'
}

export enum Align {
  Start = 'start',
  Center = 'center',
  End = 'end',
  Baseline = 'baseline'
}

export enum AlignContent {
  Auto = 'auto',
  SpaceBetween = 'space-between'
}

export enum Sizing {
  Fixed = 'fixed',
  Hug = 'hug',
  Fill = 'fill'
}

export enum TrackType {
  Fixed = 'fixed',
  Flex = 'flex',
  Hug = 'hug'
}

export enum AutoFlow {
  Row = 'row',
  Column = 'column'
}

export type TrackSize = { type: TrackType; value: number };

export type Cell = { column?: number; row?: number; columnSpan?: number; rowSpan?: number; x?: Align; y?: Align };

export type Size = { width: number; height: number };
export type Padding = { top: number; right: number; bottom: number; left: number };

export type Flow = {
  direction: Direction;
  wrap: boolean;
  gap: number;
  crossGap: number;
  padding: Padding;
  justify: Justify;
  align: Align;
  columns?: number;
  columnTracks?: TrackSize[];
  rowTracks?: TrackSize[];
  autoFlow?: AutoFlow;
  alignContent?: AlignContent;
};

export const DEFAULT_COLUMNS = 2;

export type Item = {
  id: string;
  width: number;
  height: number;
  sizing: { width: Sizing; height: Sizing };
  min?: Partial<Size>;
  max?: Partial<Size>;
  absolute?: boolean;
  baseline?: number;
  cell?: Cell;
  flow?: Flow;
  children?: Item[];
};

type Dim = keyof Size;
type Axes = { main: Dim; cross: Dim; mainStart: 'left' | 'top'; crossStart: 'left' | 'top' };

const AXES: Record<Direction, Axes> = {
  [Direction.Horizontal]: { main: 'width', cross: 'height', mainStart: 'left', crossStart: 'top' },
  [Direction.Vertical]: { main: 'height', cross: 'width', mainStart: 'top', crossStart: 'left' },
  [Direction.Grid]: { main: 'width', cross: 'height', mainStart: 'left', crossStart: 'top' }
};

const PAD: Record<Dim, (p: Padding) => number> = {
  width: (p) => p.left + p.right,
  height: (p) => p.top + p.bottom
};

const JUSTIFIED_IN_CELL: Record<Justify, (free: number) => number> = {
  [Justify.Start]: () => 0,
  [Justify.Center]: (free) => free / 2,
  [Justify.End]: (free) => free,
  [Justify.SpaceBetween]: () => 0,
  [Justify.SpaceAround]: (free) => free / 2,
  [Justify.SpaceEvenly]: (free) => free / 2
};

const ALIGNED: Record<Align, (free: number) => number> = {
  [Align.Start]: () => 0,
  [Align.Center]: (free) => free / 2,
  [Align.End]: (free) => free,
  [Align.Baseline]: () => 0
};

const JUSTIFIED: Record<Justify, (free: number, gap: number, count: number) => { offset: number; gap: number }> = {
  [Justify.Start]: (_free, gap) => ({ offset: 0, gap }),
  [Justify.Center]: (free, gap) => ({ offset: free / 2, gap }),
  [Justify.End]: (free, gap) => ({ offset: free, gap }),
  [Justify.SpaceBetween]: (free, gap, count) => ({ offset: 0, gap: count > 1 && free > 0 ? gap + free / (count - 1) : gap }),
  [Justify.SpaceAround]: (free, gap, count) => (free > 0 ? { offset: free / count / 2, gap: gap + free / count } : { offset: 0, gap }),
  [Justify.SpaceEvenly]: (free, gap, count) => (free > 0 ? { offset: free / (count + 1), gap: gap + free / (count + 1) } : { offset: 0, gap })
};

const LINE_GAP: Record<AlignContent, (free: number, gap: number, count: number) => number> = {
  [AlignContent.Auto]: (_free, gap) => gap,
  [AlignContent.SpaceBetween]: (free, gap, count) => (count > 1 && free > 0 ? gap + free / (count - 1) : gap)
};

const flowing = (item: Item): Item[] => (item.children ?? []).filter((c) => !c.absolute);

const byBaseline = (flow: Flow) => flow.align === Align.Baseline && flow.direction === Direction.Horizontal;

const baselineOf = (item: Item, height: number) => item.baseline ?? height;

function baselineLine(heights: number[], baselines: number[]): { baseline: number; height: number } {
  const baseline = Math.max(0, ...baselines);
  return { baseline, height: baseline + Math.max(0, ...heights.map((h, i) => h - baselines[i])) };
}

function clamp(item: Item, dim: Dim, value: number): number {
  const max = item.max?.[dim] ?? Infinity;
  const min = item.min?.[dim] ?? 0;
  return Math.max(min, Math.min(max, value));
}

const gaps = (count: number, gap: number) => Math.max(0, count - 1) * gap;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function lines<T>(items: T[], size: (item: T) => number, room: number, gap: number): T[][] {
  const out: T[][] = [];
  let used = 0;
  for (const item of items) {
    const line = out.at(-1);
    const next = used + (line?.length ? gap : 0) + size(item);
    if (line?.length && next > room) {
      out.push([item]);
      used = size(item);
      continue;
    }
    if (!line) {
      out.push([item]);
    } else {
      line.push(item);
    }
    used = next;
  }
  return out;
}

function hugCross(item: Item, flow: Flow, main: number): number {
  const { main: m, cross: c } = AXES[flow.direction];
  const kids = flowing(item);
  const room = main - PAD[m](flow.padding);
  const rows = flow.wrap ? lines(kids, (k) => measure(k)[m], room, flow.gap) : [kids];
  const lineCross = (r: Item[]) => {
    const sizes = r.map((k) => measure(k)[c]);
    return byBaseline(flow) ? baselineLine(sizes, r.map((k, i) => baselineOf(k, sizes[i]))).height : Math.max(...sizes);
  };
  const crosses = rows.filter((r) => r.length).map(lineCross);
  return sum(crosses) + gaps(crosses.length, flow.crossGap) + PAD[c](flow.padding);
}

function hugMain(item: Item, flow: Flow): number {
  const { main: m } = AXES[flow.direction];
  const kids = flowing(item);
  return sum(kids.map((k) => measure(k)[m])) + gaps(kids.length, flow.gap) + PAD[m](flow.padding);
}

const columnsOf = (flow: Flow) => Math.max(1, Math.round(flow.columns ?? DEFAULT_COLUMNS));

const IMPLIED_COLUMN: TrackSize = { type: TrackType.Flex, value: 1 };
const IMPLIED_ROW: TrackSize = { type: TrackType.Hug, value: 0 };

const columnTracksOf = (flow: Flow): TrackSize[] => (flow.columnTracks?.length ? flow.columnTracks : Array.from({ length: columnsOf(flow) }, () => IMPLIED_COLUMN));

const rowTracksOf = (flow: Flow, rows: number): TrackSize[] => Array.from({ length: rows }, (_, r) => flow.rowTracks?.[r] ?? IMPLIED_ROW);

type Placed = { item: Item; column: number; row: number; columnSpan: number; rowSpan: number };

const spanOf = (value: number | undefined, max: number) => Math.max(1, Math.min(max, Math.round(value ?? 1)));

function arrange(kids: Item[], flow: Flow): { cells: Placed[]; rows: number } {
  const columns = columnTracksOf(flow).length;
  const taken = new Set<string>();
  const cells: Placed[] = [];
  const fits = (row: number, column: number, rowSpan: number, columnSpan: number) => {
    if (row < 0 || column < 0 || column + columnSpan > columns) {
      return false;
    }
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = column; c < column + columnSpan; c++) {
        if (taken.has(`${r}:${c}`)) {
          return false;
        }
      }
    }
    return true;
  };
  const take = (item: Item, row: number, column: number, rowSpan: number, columnSpan: number) => {
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = column; c < column + columnSpan; c++) {
        taken.add(`${r}:${c}`);
      }
    }
    cells.push({ item, row, column, rowSpan, columnSpan });
  };
  const spans = (item: Item) => ({ columnSpan: spanOf(item.cell?.columnSpan, columns), rowSpan: spanOf(item.cell?.rowSpan, Infinity) });

  const loose: Item[] = [];
  for (const item of kids) {
    const { column, row } = item.cell ?? {};
    const { columnSpan, rowSpan } = spans(item);
    if (column === undefined || row === undefined || !fits(row, column, rowSpan, columnSpan)) {
      loose.push(item);
      continue;
    }
    take(item, row, column, rowSpan, columnSpan);
  }

  const height = Math.max(flow.rowTracks?.length ?? 0, Math.ceil(kids.length / columns));
  for (const item of loose) {
    const { columnSpan, rowSpan } = spans(item);
    const spot = flow.autoFlow === AutoFlow.Column ? downColumns(fits, columns, height, rowSpan, columnSpan) : null;
    const [row, column] = spot ?? acrossRows(fits, columns, rowSpan, columnSpan);
    take(item, row, column, rowSpan, columnSpan);
  }
  return { cells, rows: Math.max(flow.rowTracks?.length ?? 0, ...cells.map((c) => c.row + c.rowSpan)) };
}

type Fits = (row: number, column: number, rowSpan: number, columnSpan: number) => boolean;

function downColumns(fits: Fits, columns: number, height: number, rowSpan: number, columnSpan: number): [number, number] | null {
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row + rowSpan <= height; row++) {
      if (fits(row, column, rowSpan, columnSpan)) {
        return [row, column];
      }
    }
  }
  return null;
}

function acrossRows(fits: Fits, columns: number, rowSpan: number, columnSpan: number): [number, number] {
  for (let row = 0; ; row++) {
    for (let column = 0; column < columns; column++) {
      if (fits(row, column, rowSpan, columnSpan)) {
        return [row, column];
      }
    }
  }
}

const TRACK_BASE: Record<TrackType, (track: TrackSize, content: number) => number> = {
  [TrackType.Fixed]: (track) => track.value,
  [TrackType.Hug]: (_track, content) => content,
  [TrackType.Flex]: () => 0
};

function sizeTracks(tracks: TrackSize[], content: number[], room: number | undefined, gap: number): number[] {
  const base = tracks.map((t, i) => TRACK_BASE[t.type](t, content[i]));
  const flexes = tracks.filter((t) => t.type === TrackType.Flex);
  const fr = sum(flexes.map((t) => t.value));
  if (!fr) {
    return base;
  }
  const unit = room === undefined ? Math.max(0, ...tracks.map((t, i) => (t.type === TrackType.Flex && t.value > 0 ? content[i] / t.value : 0))) : Math.max(0, room - sum(base) - gaps(tracks.length, gap)) / fr;
  return tracks.map((t, i) => (t.type === TrackType.Flex ? unit * t.value : base[i]));
}

function contentOf(cells: Placed[], count: number, axis: 'column' | 'row', size: (cell: Placed) => number): number[] {
  const out = Array.from({ length: count }, () => 0);
  const spanKey = axis === 'column' ? 'columnSpan' : 'rowSpan';
  for (const cell of cells) {
    if (cell[spanKey] === 1) {
      out[cell[axis]] = Math.max(out[cell[axis]], size(cell));
    }
  }
  return out;
}

const startsOf = (sizes: number[], gap: number) => sizes.map((_, i) => sum(sizes.slice(0, i)) + i * gap);
const spanned = (sizes: number[], from: number, span: number, gap: number) => sum(sizes.slice(from, from + span)) + gaps(span, gap);

type GridSizes = { cells: Placed[]; columns: number[]; rows: number[] };

function sizeGrid(item: Item, flow: Flow, room: Partial<Size>): GridSizes {
  const { cells, rows } = arrange(flowing(item), flow);
  const columnTracks = columnTracksOf(flow);
  const columns = sizeTracks(columnTracks, contentOf(cells, columnTracks.length, 'column', (c) => measure(c.item).width), room.width, flow.gap);
  const heightOf = (c: Placed) => (c.item.sizing.height === Sizing.Fill ? 0 : measure(c.item, c.item.sizing.width === Sizing.Fill ? { width: spanned(columns, c.column, c.columnSpan, flow.gap) } : {}).height);
  const rowTracks = rowTracksOf(flow, rows);
  return { cells, columns, rows: sizeTracks(rowTracks, contentOf(cells, rows, 'row', heightOf), room.height, flow.crossGap) };
}

function hugGrid(item: Item, flow: Flow): Size {
  const { columns, rows } = sizeGrid(item, flow, {});
  return {
    width: sum(columns) + gaps(columns.length, flow.gap) + PAD.width(flow.padding),
    height: sum(rows) + gaps(rows.length, flow.crossGap) + PAD.height(flow.padding)
  };
}

function measureGrid(item: Item, flow: Flow, given: Partial<Size>): Size {
  const hugs = (dim: Dim) => given[dim] === undefined && item.sizing[dim] === Sizing.Hug;
  const hugged = hugs('width') || hugs('height') ? hugGrid(item, flow) : null;
  const side = (dim: Dim) => clamp(item, dim, given[dim] ?? (hugged && hugs(dim) ? hugged[dim] : item[dim]));
  return { width: side('width'), height: side('height') };
}

function placeGrid(item: Item, flow: Flow, inner: Box, out: Map<string, Box>): void {
  const { cells, columns, rows } = sizeGrid(item, flow, { width: inner.width, height: inner.height });
  const lefts = startsOf(columns, flow.gap);
  const tops = startsOf(rows, flow.crossGap);

  for (const { item: k, column, row, columnSpan, rowSpan } of cells) {
    const width = spanned(columns, column, columnSpan, flow.gap);
    const height = spanned(rows, row, rowSpan, flow.crossGap);
    const own = measure(k, k.sizing.width === Sizing.Fill ? { width } : {});
    const w = k.sizing.width === Sizing.Fill ? clamp(k, 'width', width) : own.width;
    const h = k.sizing.height === Sizing.Fill ? clamp(k, 'height', height) : own.height;
    const dx = k.cell?.x ? ALIGNED[k.cell.x](width - w) : JUSTIFIED_IN_CELL[flow.justify](width - w);
    const dy = ALIGNED[k.cell?.y ?? flow.align](height - h);
    place(k, { left: inner.left + lefts[column] + dx, top: inner.top + tops[row] + dy, width: w, height: h }, out);
  }
}

export function measure(item: Item, given: Partial<Size> = {}): Size {
  const { flow } = item;
  if (!flow) {
    return { width: clamp(item, 'width', given.width ?? item.width), height: clamp(item, 'height', given.height ?? item.height) };
  }
  if (flow.direction === Direction.Grid) {
    return measureGrid(item, flow, given);
  }
  const { main: m, cross: c } = AXES[flow.direction];
  const main = clamp(item, m, given[m] ?? (item.sizing[m] === Sizing.Hug ? hugMain(item, flow) : item[m]));
  const cross = clamp(item, c, given[c] ?? (item.sizing[c] === Sizing.Hug ? hugCross(item, flow, main) : item[c]));
  return { [m]: main, [c]: cross } as Size;
}

function grow(kids: Item[], base: number[], room: number, dim: Dim): number[] {
  const sizes = [...base];
  let open = kids.map((k, i) => (k.sizing[dim] === Sizing.Fill ? i : -1)).filter((i) => i >= 0);
  let left = room - sum(kids.map((k, i) => (k.sizing[dim] === Sizing.Fill ? 0 : base[i])));

  while (open.length) {
    const share = left / open.length;
    const pinned = open.filter((i) => clamp(kids[i], dim, share) !== share);
    for (const i of open) {
      sizes[i] = clamp(kids[i], dim, share);
    }
    if (!pinned.length) {
      break;
    }
    left -= sum(pinned.map((i) => sizes[i]));
    open = open.filter((i) => !pinned.includes(i));
  }
  return sizes;
}

function place(item: Item, at: Box, out: Map<string, Box>): void {
  out.set(item.id, at);
  const { flow } = item;
  if (!flow) {
    return;
  }

  const ax = AXES[flow.direction];
  const { main: m, cross: c } = ax;
  const inner = { left: at.left + flow.padding.left, top: at.top + flow.padding.top, width: at.width - PAD.width(flow.padding), height: at.height - PAD.height(flow.padding) };
  if (flow.direction === Direction.Grid) {
    placeGrid(item, flow, inner, out);
    return;
  }
  const kids = flowing(item);
  const stretched = (k: Item) => k.sizing[c] === Sizing.Fill && !flow.wrap;
  const natural = new Map(kids.map((k) => [k, measure(k, stretched(k) ? { [c]: inner[c] } : {})[m]]));
  const rows = flow.wrap ? lines(kids, (k) => natural.get(k)!, inner[m], flow.gap) : [kids];
  const stripes = rows.map((row) => {
    const room = inner[m] - gaps(row.length, flow.gap);
    const mains = grow(row, row.map((k) => natural.get(k)!), room, m);
    const crossOf = (k: Item, i: number) => measure(k, { [m]: mains[i] })[c];
    const lineCross = flow.wrap ? Math.max(...row.map(crossOf)) : inner[c];
    const crosses = row.map((k, i) => (k.sizing[c] === Sizing.Fill ? clamp(k, c, lineCross) : crossOf(k, i)));
    return { row, mains, lineCross, crosses };
  });
  const lineGap = LINE_GAP[flow.alignContent ?? AlignContent.Auto](inner[c] - sum(stripes.map((l) => l.lineCross)) - gaps(stripes.length, flow.crossGap), flow.crossGap, stripes.length);
  let crossAt = inner[ax.crossStart];

  for (const { row, mains, lineCross, crosses } of stripes) {
    const line = baselineLine(crosses, row.map((k, i) => baselineOf(k, crosses[i])));
    const crossOffset = (i: number) => (byBaseline(flow) ? line.baseline - baselineOf(row[i], crosses[i]) : ALIGNED[flow.align](lineCross - crosses[i]));
    const { offset, gap } = JUSTIFIED[flow.justify](inner[m] - sum(mains) - gaps(row.length, flow.gap), flow.gap, row.length);
    let mainAt = inner[ax.mainStart] + offset;

    row.forEach((k, i) => {
      const box = { [ax.mainStart]: mainAt, [ax.crossStart]: crossAt + crossOffset(i), [m]: mains[i], [c]: crosses[i] } as Box;
      place(k, box, out);
      mainAt += mains[i] + gap;
    });
    crossAt += lineCross + lineGap;
  }
}

export function layoutTree(root: Item, at: { left: number; top: number } = { left: 0, top: 0 }): Map<string, Box> {
  const out = new Map<string, Box>();
  place(root, { ...at, ...measure(root) }, out);
  return out;
}
