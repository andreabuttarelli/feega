import type { Box } from '../layout';

export enum Direction {
  Horizontal = 'horizontal',
  Vertical = 'vertical'
}

export enum Justify {
  Start = 'start',
  Center = 'center',
  End = 'end',
  SpaceBetween = 'space-between'
}

export enum Align {
  Start = 'start',
  Center = 'center',
  End = 'end'
}

export enum Sizing {
  Fixed = 'fixed',
  Hug = 'hug',
  Fill = 'fill'
}

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
};

export type Item = {
  id: string;
  width: number;
  height: number;
  sizing: { width: Sizing; height: Sizing };
  min?: Partial<Size>;
  max?: Partial<Size>;
  absolute?: boolean;
  flow?: Flow;
  children?: Item[];
};

type Dim = keyof Size;
type Axes = { main: Dim; cross: Dim; mainStart: 'left' | 'top'; crossStart: 'left' | 'top' };

const AXES: Record<Direction, Axes> = {
  [Direction.Horizontal]: { main: 'width', cross: 'height', mainStart: 'left', crossStart: 'top' },
  [Direction.Vertical]: { main: 'height', cross: 'width', mainStart: 'top', crossStart: 'left' }
};

const PAD: Record<Dim, (p: Padding) => number> = {
  width: (p) => p.left + p.right,
  height: (p) => p.top + p.bottom
};

const ALIGNED: Record<Align, (free: number) => number> = {
  [Align.Start]: () => 0,
  [Align.Center]: (free) => free / 2,
  [Align.End]: (free) => free
};

const JUSTIFIED: Record<Justify, (free: number, gap: number, count: number) => { offset: number; gap: number }> = {
  [Justify.Start]: (_free, gap) => ({ offset: 0, gap }),
  [Justify.Center]: (free, gap) => ({ offset: free / 2, gap }),
  [Justify.End]: (free, gap) => ({ offset: free, gap }),
  [Justify.SpaceBetween]: (free, gap, count) => ({ offset: 0, gap: count > 1 && free > 0 ? gap + free / (count - 1) : gap })
};

const flowing = (item: Item): Item[] => (item.children ?? []).filter((c) => !c.absolute);

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
  const crosses = rows.filter((r) => r.length).map((r) => Math.max(...r.map((k) => measure(k)[c])));
  return sum(crosses) + gaps(crosses.length, flow.crossGap) + PAD[c](flow.padding);
}

function hugMain(item: Item, flow: Flow): number {
  const { main: m } = AXES[flow.direction];
  const kids = flowing(item);
  return sum(kids.map((k) => measure(k)[m])) + gaps(kids.length, flow.gap) + PAD[m](flow.padding);
}

export function measure(item: Item, given: Partial<Size> = {}): Size {
  const { flow } = item;
  if (!flow) {
    return { width: clamp(item, 'width', given.width ?? item.width), height: clamp(item, 'height', given.height ?? item.height) };
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
  const kids = flowing(item);
  const stretched = (k: Item) => k.sizing[c] === Sizing.Fill && !flow.wrap;
  const natural = new Map(kids.map((k) => [k, measure(k, stretched(k) ? { [c]: inner[c] } : {})[m]]));
  const rows = flow.wrap ? lines(kids, (k) => natural.get(k)!, inner[m], flow.gap) : [kids];
  let crossAt = inner[ax.crossStart];

  for (const row of rows) {
    const room = inner[m] - gaps(row.length, flow.gap);
    const mains = grow(row, row.map((k) => natural.get(k)!), room, m);
    const crossOf = (k: Item, i: number) => measure(k, { [m]: mains[i] })[c];
    const lineCross = flow.wrap ? Math.max(...row.map(crossOf)) : inner[c];
    const crosses = row.map((k, i) => (k.sizing[c] === Sizing.Fill ? clamp(k, c, lineCross) : crossOf(k, i)));
    const { offset, gap } = JUSTIFIED[flow.justify](inner[m] - sum(mains) - gaps(row.length, flow.gap), flow.gap, row.length);
    let mainAt = inner[ax.mainStart] + offset;

    row.forEach((k, i) => {
      const box = { [ax.mainStart]: mainAt, [ax.crossStart]: crossAt + ALIGNED[flow.align](lineCross - crosses[i]), [m]: mains[i], [c]: crosses[i] } as Box;
      place(k, box, out);
      mainAt += mains[i] + gap;
    });
    crossAt += lineCross + flow.crossGap;
  }
}

export function layoutTree(root: Item, at: { left: number; top: number } = { left: 0, top: 0 }): Map<string, Box> {
  const out = new Map<string, Box>();
  place(root, { ...at, ...measure(root) }, out);
  return out;
}
