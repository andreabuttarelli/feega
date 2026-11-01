import { DESIGN_MAX_SIDE, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addBreakpoint, OverrideKey, setOverride } from '@feega/motion-core/motion/breakpoints/model';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';

export type PageView = { id: string; name: string; width: number };

export const PAGE_VIEWS: PageView[] = [
  { id: 'tablet', name: 'Tablet', width: 768 },
  { id: 'phone', name: 'Phone', width: 390 }
];

export type ViewRead = { view: PageView; tree: PageTree };

export const viewsOf = (breakpoints: boolean): PageView[] => (breakpoints ? PAGE_VIEWS : []);

type Box = { x: number; y: number; width: number; height: number };
type Shift = { x: number; y: number };

const keyed = (n: RestNode, into = new Map<string, RestNode>()): Map<string, RestNode> => {
  if (n.key && !n.collapsed) {
    into.set(n.key, n);
  }
  (n.children ?? []).forEach((c) => keyed(c, into));
  return into;
};

const moved = (b: Box, by: Shift): Box => ({ ...b, x: b.x + by.x, y: b.y + by.y });

const unionOf = (boxes: Box[]): Box | null => {
  if (!boxes.length) {
    return null;
  }
  const [x, y] = [Math.min(...boxes.map((b) => b.x)), Math.min(...boxes.map((b) => b.y))];
  return { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x, height: Math.max(...boxes.map((b) => b.y + b.height)) - y };
};

type Seen = { nodes: Map<string, RestNode>; paths: Set<string> };

const elementOf = (key: string) => key.split('~')[0];

function seenIn(root: RestNode): Seen {
  const nodes = keyed(root);
  const paths = new Set<string>();
  for (const key of nodes.keys()) {
    const parts = elementOf(key).split('/');
    parts.forEach((_, i) => paths.add(parts.slice(0, i + 1).join('/')));
  }
  return { nodes, paths };
}

const LINE = /^(.*)\.(\d+)$/;
const NAME_CHARS = 40;

const EDGES: Record<string, (b: Box) => number> = {
  LEFT: (b) => b.x,
  CENTER: (b) => b.x + b.width / 2,
  RIGHT: (b) => b.x + b.width
};

function alignOf(boxes: Box[]): string {
  const spread = (edge: (b: Box) => number) => Math.max(...boxes.map(edge)) - Math.min(...boxes.map(edge));
  return Object.entries(EDGES).reduce((best, [align, edge]) => (spread(edge) < spread(EDGES[best]) ? align : best), 'LEFT');
}

const paragraphOf = (n: RestNode) => (n.type === 'TEXT' && !n.characterStyleOverrides?.length ? n.key?.match(LINE)?.[1] : undefined);

function joined(lines: RestNode[], key: string): RestNode {
  const boxes = lines.map((l) => l.absoluteBoundingBox!);
  const pitch = (boxes[boxes.length - 1].y - boxes[0].y) / (lines.length - 1);
  const [first] = lines;
  const characters = lines.map((l) => l.characters).join(' ');
  return {
    ...first,
    key,
    name: characters.slice(0, NAME_CHARS),
    characters,
    absoluteBoundingBox: unionOf(boxes)!,
    textAutoResize: 'HEIGHT',
    style: { ...first.style, textAlignHorizontal: alignOf(boxes), lineHeightPx: pitch > 0 ? pitch : first.style?.lineHeightPx }
  };
}

function joinedLines(n: RestNode): RestNode {
  if (!n.children?.length) {
    return n;
  }
  const runs: RestNode[][] = [];
  for (const c of n.children.map(joinedLines)) {
    const last = runs[runs.length - 1];
    const para = paragraphOf(c);
    if (para && last && paragraphOf(last[0]) === para) {
      last.push(c);
      continue;
    }
    runs.push([c]);
  }
  return { ...n, children: runs.map((run) => (run.length > 1 ? joined(run, paragraphOf(run[0])!) : run[0])) };
}

export const joinedTree = (tree: PageTree): PageTree => ({ ...tree, root: joinedLines(tree.root) });

function counterpart(key: string, seen: Seen): RestNode | null {
  const own = seen.nodes.get(key);
  if (own) {
    return own;
  }
  const lines = [...seen.nodes.entries()].filter(([k]) => k.startsWith(`${key}.`)).map(([, n]) => n);
  const box = unionOf(lines.map((n) => n.absoluteBoundingBox!));
  if (box) {
    return { ...lines[0], absoluteBoundingBox: box };
  }
  const line = key.match(LINE);
  const whole = line ? seen.nodes.get(line[1]) : undefined;
  return whole && line?.[2] === '0' ? whole : null;
}

function topOf(n: RestNode, seen: Seen): number {
  const own = n.key ? counterpart(n.key, seen)?.absoluteBoundingBox?.y : undefined;
  return Math.min(own ?? Infinity, ...(n.children ?? []).map((c) => topOf(c, seen)));
}

function placed(n: RestNode, seen: Seen, carry: Shift, up: number): RestNode {
  const box = n.absoluteBoundingBox!;
  const found = n.key ? counterpart(n.key, seen) : null;
  const gone = Boolean(n.key) && !found && !seen.paths.has(elementOf(n.key!));
  if (gone) {
    return { ...n, collapsed: true, absoluteBoundingBox: moved(box, carry), ...(n.children ? { children: n.children.map((c) => placed(c, seen, carry, up)) } : {}) };
  }
  const there = found ? { ...found.absoluteBoundingBox!, y: found.absoluteBoundingBox!.y - up } : null;
  const shift = there ? { x: there.x - box.x, y: there.y - box.y } : carry;
  const children = n.children?.map((c) => placed(c, seen, shift, up));
  const own = there ?? (children?.length ? (unionOf(children.filter((c) => !c.collapsed).map((c) => c.absoluteBoundingBox!)) ?? moved(box, carry)) : moved(box, carry));
  const text = found?.type === 'TEXT' && n.type === 'TEXT' ? { style: { ...n.style, ...found.style }, textAutoResize: found.textAutoResize } : {};
  return { ...n, ...text, ...(found ? { collapsed: undefined } : {}), absoluteBoundingBox: own, ...(children ? { children } : {}) };
}

const pathsOf = (root: RestNode) => seenIn(root).paths;

function extrasIn(n: RestNode, known: Set<string>, into: RestNode[]): RestNode[] {
  if (n.key && !n.collapsed && !known.has(elementOf(n.key))) {
    into.push(n);
    return into;
  }
  (n.children ?? []).forEach((c) => extrasIn(c, known, into));
  return into;
}

const hiddenCopy = (n: RestNode, top: number, view: string): RestNode => ({ ...n, id: `${view}:${n.id}`, collapsed: true, absoluteBoundingBox: { ...n.absoluteBoundingBox!, y: top }, ...(n.children ? { children: n.children.map((c) => hiddenCopy(c, top, view)) } : {}) });

export function withExtras(root: RestNode, views: ViewRead[]): RestNode {
  const known = pathsOf(root);
  const extras = new Map(views.flatMap(({ view, tree }) => extrasIn(tree.root, known, []).map((n) => hiddenCopy(n, root.absoluteBoundingBox!.y, view.id))).map((n) => [n.key!, n]));
  if (!extras.size) {
    return root;
  }
  return { ...root, children: [...(root.children ?? []), ...extras.values()] };
}

export enum Slice {
  First = 'first',
  Later = 'later'
}

const LIFT: Record<Slice, (root: RestNode, seen: Seen) => number> = {
  [Slice.First]: () => 0,
  [Slice.Later]: (root, seen) => {
    const up = Math.min(...(root.children ?? []).map((c) => topOf(c, seen))) - Math.min(...(root.children ?? []).map((c) => c.absoluteBoundingBox!.y));
    return Number.isFinite(up) ? up : 0;
  }
};

export function viewedRoot(root: RestNode, view: PageTree, slice: Slice): RestNode {
  const seen = seenIn(view.root);
  const lift = LIFT[slice](root, seen);
  const children = (root.children ?? []).map((c) => placed(c, seen, { x: 0, y: 0 }, lift));
  return { ...root, absoluteBoundingBox: reaching({ ...root.absoluteBoundingBox!, width: view.width }, children), children };
}

function reaching(box: Box, children: RestNode[]): Box {
  const bottoms = children.filter((c) => !c.collapsed).map((c) => c.absoluteBoundingBox!.y + c.absoluteBoundingBox!.height);
  return bottoms.length ? { ...box, height: Math.max(...bottoms) - box.y } : box;
}

type Write = [string, OverrideKey, unknown];

enum Anchor {
  Frame = 'frame',
  Pixels = 'pixels'
}

type Placed = { clip: MotionClip; comp: string | null; parentFlows: boolean };

function clipsById(doc: MotionDoc): Map<string, Placed> {
  const scopes: [string | null, MotionClip[]][] = [[null, doc.tracks.flatMap((t) => t.clips) as MotionClip[]], ...Object.entries(doc.comps ?? {}).map(([comp, c]) => [comp, c.tracks.flatMap((t) => t.clips) as MotionClip[]] as [string, MotionClip[]])];
  return new Map(
    scopes.flatMap(([comp, clips]) => {
      const byId = new Map(clips.map((c) => [c.id, c]));
      return clips.map((clip) => [clip.id, { clip, comp, parentFlows: Boolean(clip.parent && byId.get(clip.parent)?.autoLayout) && !clip.layoutItem?.absolute }] as const);
    })
  );
}

const nodesById = (n: RestNode, into = new Map<string, RestNode>()): Map<string, RestNode> => {
  into.set(n.id, n);
  (n.children ?? []).forEach((c) => nodesById(c, into));
  return into;
};

const NEAR_PX = 0.5;
const TEXT = 'Text';
const NO_WRAP = 'none';
const PRECOMP = 'Precomp';

const near = (a: number, b: number) => Math.abs(a - b) <= NEAR_PX;

function writesFor(placed: Placed, before: RestNode, after: RestNode, root: Box, across: number, scale: number): Write[] {
  const { clip } = placed;
  const id = clip.id;
  if (after.collapsed && !before.collapsed) {
    return [[id, OverrideKey.Hidden, true]];
  }
  const shown: Write[] = before.collapsed && !after.collapsed ? [[id, OverrideKey.Hidden, false]] : [];
  if (after.collapsed) {
    return shown;
  }
  const [a, b] = [before.absoluteBoundingBox!, after.absoluteBoundingBox!];
  const moved = clip.component !== PRECOMP && (!near(a.x, b.x) || !near(a.y, b.y) || !near(a.width, b.width) || !near(a.height, b.height) || placed.parentFlows);
  const anchor = placed.comp ? Anchor.Pixels : Anchor.Frame;
  const wide = (v: number) => (anchor === Anchor.Frame ? v * across : v);
  const width = b.width / root.width;
  const box: Write[] = moved
    ? [
        [id, OverrideKey.X, wide((b.x - root.x + b.width / 2) / root.width)],
        [id, OverrideKey.Y, (b.y - root.y + b.height / 2) / root.height],
        [id, OverrideKey.BoxWidth, clip.parent || anchor === Anchor.Pixels ? width : wide(width)],
        [id, OverrideKey.BoxHeight, b.height / root.height]
      ]
    : [];
  const flow: Write[] = placed.parentFlows ? [[id, OverrideKey.Absolute, true]] : [];
  const sized: Write[] = clip.autoLayout && moved ? [[id, OverrideKey.Width, 'fixed'], [id, OverrideKey.Height, 'fixed']] : [];
  const unit = Math.min(root.width, root.height);
  const [fa, fb] = [before.style?.fontSize, after.style?.fontSize];
  const text: Write[] =
    clip.component === TEXT
      ? [
          ...(!near(a.width, b.width) ? ([[id, OverrideKey.TextSizing, 'auto-height'], ...(clip.props.textWrap === NO_WRAP ? [[id, OverrideKey.TextWrap, 'wrap']] : [])] as Write[]) : []),
          ...(fa && fb && !near(fa, fb) ? ([[id, OverrideKey.FontSize, fb / unit]] as Write[]) : []),
          ...(after.style?.lineHeightPx && before.style?.lineHeightPx !== after.style.lineHeightPx ? ([[id, OverrideKey.LineHeight, `${Math.round(after.style.lineHeightPx * scale * 100) / 100}px`]] as Write[]) : [])
        ]
      : [];
  return [...shown, ...box, ...flow, ...sized, ...text];
}

export function withView(base: MotionDoc, keys: Record<string, string>, root: RestNode, viewed: RestNode, view: PageView, pagePx: number): MotionDoc {
  const width = Math.round(view.width * (base.width / pagePx));
  const height = Math.min(DESIGN_MAX_SIDE, Math.round(base.height * (viewed.absoluteBoundingBox!.height / root.absoluteBoundingBox!.height)));
  const added = addBreakpoint(base, { name: view.name, width, height }, view.id);
  if (!added.ok) {
    return base;
  }
  const across = base.width / width;
  const [before, after, clips] = [nodesById(root), nodesById(viewed), clipsById(base)];
  const box = root.absoluteBoundingBox!;
  return Object.entries(keys).reduce((doc, [ref, clipId]) => {
    const [b, a, placed] = [before.get(ref), after.get(ref), clips.get(clipId)];
    if (!b || !a || !placed) {
      return doc;
    }
    return writesFor(placed, b, a, box, across, base.width / box.width).reduce((d, [id, key, value]) => {
      const set = setOverride(d, view.id, id, key, value, placed.comp);
      return set.ok ? set.doc : d;
    }, doc);
  }, added.doc);
}
