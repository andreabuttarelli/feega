import type { RestNode } from '$lib/server/figma/rest-message';

type Box = { x: number; y: number; width: number; height: number };

enum Axis {
  Column = 'VERTICAL',
  Row = 'HORIZONTAL'
}

type Side = { start: 'x' | 'y'; size: 'width' | 'height' };

const SIDES: Record<Axis, { main: Side; cross: Side; other: Axis }> = {
  [Axis.Column]: { main: { start: 'y', size: 'height' }, cross: { start: 'x', size: 'width' }, other: Axis.Row },
  [Axis.Row]: { main: { start: 'x', size: 'width' }, cross: { start: 'y', size: 'height' }, other: Axis.Column }
};

const AXES = [Axis.Column, Axis.Row];
const EPS = 0.5;
const OVERLAP_PX = 0.5;
const SPREAD_SHARE = 0.8;
const STACK_ID = 'stack:';
const VECTORS = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'LINE', 'STAR', 'REGULAR_POLYGON']);
const STACKABLE = new Set(['FRAME']);

type Offsets = { lead: number[]; trail: number[] };

const same = (values: number[]) => values.every((v) => Math.abs(v - values[0]) <= EPS);

const ALIGNMENTS: { align: string; fits: (o: Offsets) => boolean; padding: (o: Offsets) => [number, number] }[] = [
  { align: 'CENTER', fits: (o) => o.lead.every((l, i) => Math.abs(l - o.trail[i]) <= EPS) && o.lead.some((l) => l > EPS), padding: (o) => [Math.min(...o.lead), Math.min(...o.trail)] },
  { align: 'MIN', fits: (o) => same(o.lead), padding: (o) => [o.lead[0], Math.max(0, Math.min(...o.trail))] },
  { align: 'MAX', fits: (o) => same(o.trail), padding: (o) => [Math.max(0, Math.min(...o.lead)), o.trail[0]] },
  { align: 'CENTER', fits: (o) => same(o.lead.map((l, i) => l - o.trail[i])), padding: (o) => [Math.max(0, o.lead[0] - o.trail[0]), Math.max(0, o.trail[0] - o.lead[0])] }
];

const spread = new WeakSet<RestNode>();

let made = 0;
const nextId = () => `${STACK_ID}${++made}`;

const boxOf = (n: RestNode): Box => n.absoluteBoundingBox!;
const endOf = (b: Box, s: Side) => b[s.start] + b[s.size];
const round = (v: number) => Math.round(v * 100) / 100;

const union = (kids: RestNode[]): Box => {
  const [x, y] = [Math.min(...kids.map((k) => boxOf(k).x)), Math.min(...kids.map((k) => boxOf(k).y))];
  return { x, y, width: Math.max(...kids.map((k) => endOf(boxOf(k), SIDES[Axis.Row].main))) - x, height: Math.max(...kids.map((k) => endOf(boxOf(k), SIDES[Axis.Column].main))) - y };
};

const wrapper = (box: Box, children: RestNode[], name: string): RestNode => ({ id: nextId(), type: 'FRAME', name, absoluteBoundingBox: box, fills: [], clipsContent: false, children });

const flowing = (k: RestNode) => k.layoutPositioning !== 'ABSOLUTE';

const drawing = (n: RestNode) => (n.children ?? []).some((c) => VECTORS.has(c.type));

const stackable = (n: RestNode) => STACKABLE.has(n.type) && (n.opacity ?? 1) >= 1 && !n.effects?.length && !n.clipsContent && !n.layoutMode && !n.relativeTransform && Boolean(n.absoluteBoundingBox) && !drawing(n);

function clusters(kids: RestNode[], s: Side): RestNode[][] {
  const sorted = [...kids].sort((a, b) => boxOf(a)[s.start] - boxOf(b)[s.start]);
  const out: RestNode[][] = [];
  let reach = -Infinity;
  for (const k of sorted) {
    if (boxOf(k)[s.start] < reach - OVERLAP_PX) {
      out[out.length - 1].push(k);
      reach = Math.max(reach, endOf(boxOf(k), s));
      continue;
    }
    out.push([k]);
    reach = endOf(boxOf(k), s);
  }
  return out;
}

function grouped(items: RestNode[], s: Side): { items: RestNode[]; gap: number } {
  const gaps = items.slice(1).map((k, i) => boxOf(k)[s.start] - endOf(boxOf(items[i]), s));
  const gap = gaps.length ? Math.max(...gaps) : 0;
  if (same(gaps)) {
    return { items, gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0 };
  }
  const runs: RestNode[][] = [[items[0]]];
  gaps.forEach((g, i) => (Math.abs(g - gap) <= EPS ? runs.push([items[i + 1]]) : runs[runs.length - 1].push(items[i + 1])));
  return { items: runs.map((run) => (run.length === 1 ? run[0] : wrapper(union(run), run, 'stack'))), gap };
}

function boxed(k: RestNode): RestNode {
  return k.type === 'GROUP' ? { ...k, type: 'FRAME', fills: [], clipsContent: false } : k;
}

function aligned(items: RestNode[], box: Box, s: Side): { items: RestNode[]; align: string; pad: [number, number] } {
  const offsets = (list: RestNode[]): Offsets => ({ lead: list.map((k) => boxOf(k)[s.start] - box[s.start]), trail: list.map((k) => endOf(box, s) - endOf(boxOf(k), s)) });
  const found = ALIGNMENTS.find((a) => a.fits(offsets(items)));
  if (found) {
    return { items, align: found.align, pad: found.padding(offsets(items)) };
  }
  const lead = Math.min(...offsets(items).lead);
  const shifted = items.map((k) => {
    const b = boxOf(k);
    const at = box[s.start] + lead;
    if (b[s.start] - at <= EPS) {
      return k;
    }
    return wrapper({ ...b, [s.start]: at, [s.size]: endOf(b, s) - at }, [k], k.name ?? 'stack');
  });
  return { items: shifted, align: 'MIN', pad: [lead, Math.max(0, Math.min(...offsets(shifted).trail))] };
}

function stretchedIn(items: RestNode[], box: Box, s: Side, pad: [number, number]): RestNode[] {
  const span = box[s.size] - pad[0] - pad[1];
  return items.map((k) => (k.type === 'FRAME' && Math.abs(boxOf(k)[s.size] - span) <= EPS ? { ...k, layoutAlign: 'STRETCH' } : k));
}

function rowOf(kids: RestNode[], all: Box, cross: Side, axis: Axis): RestNode {
  const own = union(kids);
  const name = axis === Axis.Row ? 'row' : 'column';
  if (own[cross.size] < all[cross.size] * SPREAD_SHARE) {
    return wrapper(own, kids, name);
  }
  const made = wrapper({ ...own, [cross.start]: all[cross.start], [cross.size]: all[cross.size] }, kids, name);
  spread.add(made);
  return made;
}

function laidOut(n: RestNode, kids: RestNode[]): RestNode | null {
  const box = boxOf(n);
  const axis = AXES.find((a) => kids.length === 1 || clusters(kids, SIDES[a].main).length > 1);
  if (!axis) {
    return null;
  }
  const { main, cross, other } = SIDES[axis];
  const all = union(kids);
  const rows = clusters(kids, main).map((c) => (c.length === 1 ? c[0] : layered(rowOf(c, all, cross, other))));
  const { items: runs, gap } = grouped(rows, main);
  const lead = boxOf(runs[0])[main.start] - box[main.start];
  const trail = endOf(box, main) - endOf(boxOf(runs.at(-1)!), main);
  if (lead < -EPS || trail < -EPS) {
    return null;
  }
  const { items, align, pad } = aligned(runs.map((r) => (r.id.startsWith(STACK_ID) && !r.layoutMode ? layered(r) : r)), box, cross);
  if (pad[0] < -EPS) {
    return null;
  }
  const flow = stretchedIn(items.map((k) => (k.layoutMode ? k : layered(boxed(k)))), box, cross, pad);
  const children = n.children ?? [];
  const firstFlowing = children.findIndex(flowing);
  const before = children.slice(0, firstFlowing).filter((k) => !flowing(k));
  const after = children.slice(firstFlowing).filter((k) => !flowing(k));
  const [start, end] = axis === Axis.Column ? [lead, trail] : pad;
  const [left, right] = axis === Axis.Column ? pad : [lead, trail];
  return {
    ...n,
    ...(n.type === 'GROUP' ? { type: 'FRAME', fills: [], clipsContent: false } : {}),
    layoutMode: axis,
    itemSpacing: round(gap),
    paddingTop: round(Math.max(0, start)),
    paddingRight: round(Math.max(0, right)),
    paddingBottom: round(Math.max(0, end)),
    paddingLeft: round(Math.max(0, left)),
    primaryAxisAlignItems: spread.has(n) && items.length > 1 ? 'SPACE_BETWEEN' : 'MIN',
    counterAxisAlignItems: align,
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'FIXED',
    children: [...before, ...flow, ...after]
  };
}

function layered(n: RestNode): RestNode {
  const kids = (n.children ?? []).filter(flowing);
  const enough = !kids.some((k) => k.type === 'TEXT') && (n.type === 'FRAME' ? kids.length >= 1 : kids.length >= 2);
  return (stackable(n) && enough ? laidOut(n, kids) : null) ?? n;
}

function filled(n: RestNode): RestNode {
  const axis = n.layoutMode as Axis;
  if (!SIDES[axis] || !n.children) {
    return n;
  }
  const pad: [number, number] = axis === Axis.Column ? [n.paddingLeft ?? 0, n.paddingRight ?? 0] : [n.paddingTop ?? 0, n.paddingBottom ?? 0];
  return { ...n, children: n.children.map((k) => (flowing(k) && !k.layoutAlign ? stretchedIn([k], boxOf(n), SIDES[axis].cross, pad)[0] : k)) };
}

export function stacksOf(n: RestNode): RestNode {
  const within = n.children ? { ...n, children: n.children.map(stacksOf) } : n;
  return n.layoutMode ? filled(within) : layered(within);
}

export function absoluteShare(root: RestNode): number {
  let [free, all] = [0, 0];
  const walk = (k: RestNode, parent: RestNode) => {
    if (drawing(parent)) {
      return;
    }
    all++;
    if (!parent.layoutMode || k.layoutPositioning === 'ABSOLUTE') {
      free++;
    }
    (k.children ?? []).forEach((c) => walk(c, k));
  };
  (root.children ?? []).forEach((c) => walk(c, root));
  return all ? free / all : 0;
}
