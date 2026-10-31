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

const FIXED_TEXT = 'NONE';
const ONE_LINE_TEXT = 'WIDTH_AND_HEIGHT';
const WRAPPING_TEXT = 'HEIGHT';
const linesOf = (k: RestNode) => Math.round(boxOf(k).height / (k.style?.lineHeightPx || boxOf(k).height));
const AXES = [Axis.Column, Axis.Row];
const EPS = 0.5;
const OVERLAP_PX = 0.5;
const SPREAD_SHARE = 0.8;
const LINE_GAP_PX = 1;
const TEXT_OVERLAP_SHARE = 0.25;
const LINE_BREAK = '\n';
const BACKDROPS = new Set(['RECTANGLE', 'FRAME']);
const STACK_ID = 'stack:';
const VECTORS = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'LINE', 'STAR', 'REGULAR_POLYGON']);
const STACKABLE = new Set(['FRAME', 'GROUP']);

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

const linesTouch = (kids: RestNode[]) => {
  const sorted = [...kids].sort((a, b) => boxOf(a).y - boxOf(b).y);
  return sorted.slice(1).every((k, i) => boxOf(k).y > boxOf(sorted[i]).y + boxOf(sorted[i]).height / 2 && boxOf(k).y - endOf(boxOf(sorted[i]), SIDES[Axis.Column].main) <= LINE_GAP_PX);
};

const holdsItsKids = (n: RestNode) => !n.clipsContent || (n.children ?? []).every((k) => flowing(k) && inside(boxOf(k), boxOf(n)));

const stackable = (n: RestNode) => STACKABLE.has(n.type) && (n.opacity ?? 1) >= 1 && holdsItsKids(n) && !n.layoutMode && !n.relativeTransform && Boolean(n.absoluteBoundingBox) && !drawing(n);

const overlapOf = (k: RestNode, s: Side) => (k.type === 'TEXT' ? boxOf(k)[s.size] * TEXT_OVERLAP_SHARE : OVERLAP_PX);

function clusters(kids: RestNode[], s: Side): RestNode[][] {
  const sorted = [...kids].sort((a, b) => boxOf(a)[s.start] - boxOf(b)[s.start]);
  const out: RestNode[][] = [];
  let reach = -Infinity;
  for (const k of sorted) {
    if (boxOf(k)[s.start] < reach - overlapOf(k, s)) {
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

const TEXT_SIZING: Record<Axis, (k: RestNode) => string> = {
  [Axis.Column]: (k) => (k.textAutoResize === WRAPPING_TEXT || linesOf(k) > 1 ? FIXED_TEXT : ONE_LINE_TEXT),
  [Axis.Row]: () => FIXED_TEXT
};

const BOXED: Record<string, (k: RestNode, axis: Axis) => RestNode> = {
  GROUP: (k) => ({ ...k, type: 'FRAME', fills: [], clipsContent: false }),
  TEXT: (k, axis) => ({ ...k, textAutoResize: TEXT_SIZING[axis](k) })
};

const boxed = (k: RestNode, axis: Axis): RestNode => BOXED[k.type]?.(k, axis) ?? k;

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

const membersOf = (k: RestNode): string[] => (k.id.startsWith(STACK_ID) ? (k.children ?? []).flatMap(membersOf) : [k.id]);

function painted(children: RestNode[], flow: RestNode[]): RestNode[] {
  const slot = new Map(flow.flatMap((item, i) => membersOf(item).map((id) => [id, i] as const)));
  const out: RestNode[] = [];
  let next = 0;
  for (const k of children) {
    if (!flowing(k)) {
      out.push(k);
      continue;
    }
    const i = slot.get(k.id) ?? -1;
    if (i < next) {
      continue;
    }
    if (i > next) {
      return [...children.filter((c) => !flowing(c)), ...flow];
    }
    out.push(flow[i]);
    next++;
  }
  return next === flow.length ? out : [...children.filter((c) => !flowing(c)), ...flow];
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
  if (lead < -EPS) {
    return null;
  }
  const { items, align, pad } = aligned(runs.map((r) => (r.id.startsWith(STACK_ID) && !r.layoutMode ? layered(r) : r)), box, cross);
  if (pad[0] < -EPS) {
    return null;
  }
  const flow = stretchedIn(items.map((k) => (k.layoutMode ? k : layered(boxed(k, axis)))), box, cross, pad);
  const children = n.children ?? [];
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
    primaryAxisAlignItems: spread.has(n) && items.length > 1 && gap >= 0 ? 'SPACE_BETWEEN' : 'MIN',
    counterAxisAlignItems: align,
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'FIXED',
    children: painted(children, flow)
  };
}

const sameLook = (kids: RestNode[]) => kids.every((k) => !k.characterStyleOverrides?.length && JSON.stringify([k.style, k.fills]) === JSON.stringify([kids[0].style, kids[0].fills]));

function paragraphOf(kids: RestNode[]): RestNode | null {
  if (kids.length < 2 || !kids.every((k) => k.type === 'TEXT') || !linesTouch(kids) || !sameLook(kids)) {
    return null;
  }
  const lines = [...kids].sort((a, b) => boxOf(a).y - boxOf(b).y);
  return { ...lines[0], characters: lines.map((k) => k.characters ?? '').join(LINE_BREAK), absoluteBoundingBox: union(lines) };
}

const inside = (b: Box, a: Box) => b.x >= a.x - EPS && b.y >= a.y - EPS && endOf(b, SIDES[Axis.Row].main) <= endOf(a, SIDES[Axis.Row].main) + EPS && endOf(b, SIDES[Axis.Column].main) <= endOf(a, SIDES[Axis.Column].main) + EPS;

const leaf = (k: RestNode) => BACKDROPS.has(k.type) && !k.children?.length;

const OVERLAYS: { lifts: (k: RestNode, kids: RestNode[]) => boolean }[] = [
  { lifts: (k, kids) => kids.length > 2 && leaf(k) && inside(union(kids.filter((o) => o !== k)), boxOf(k)) },
  { lifts: (k, kids) => kids.some((o) => o !== k && !leaf(o) && inside(boxOf(k), boxOf(o)) && !inside(boxOf(o), boxOf(k))) }
];

function withOverlays(n: RestNode): RestNode {
  const kids = (n.children ?? []).filter(flowing);
  const lifted = new Set(kids.filter((k) => OVERLAYS.some((rule) => rule.lifts(k, kids))));
  if (!lifted.size || lifted.size === kids.length) {
    return n;
  }
  return { ...n, children: n.children!.map((k) => (lifted.has(k) ? { ...k, layoutPositioning: 'ABSOLUTE' } : k)) };
}

function withParagraph(n: RestNode): RestNode {
  const kids = (n.children ?? []).filter(flowing);
  const merged = paragraphOf(kids);
  if (!merged) {
    return n;
  }
  const first = n.children!.findIndex((k) => kids.includes(k));
  return { ...n, children: n.children!.flatMap((k, i) => (i === first ? [merged] : kids.includes(k) ? [] : [k])) };
}

function layered(raw: RestNode): RestNode {
  const n = stackable(raw) ? withOverlays(withParagraph(raw)) : raw;
  const kids = (n.children ?? []).filter(flowing);
  const enough = kids.length >= 1;
  return (stackable(n) && enough ? laidOut(n, kids) : null) ?? raw;
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
