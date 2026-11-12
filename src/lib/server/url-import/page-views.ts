import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { addBreakpoint, liftEdit, resolveAt } from '@feega/motion-core/motion/breakpoints/model';
import { DEFAULT_LAYOUT_ITEM } from '@feega/motion-core/motion/layout/model';
import { Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import type { FigmaImage, PlanItem } from '$lib/canvas/figma/figma-doc';
import { PictureFit } from '$lib/canvas/figma/scene';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';
import { uniformRadius } from './corner-radius';

export type PageView = { id: string; name: string; width: number };

export const PAGE_VIEWS: PageView[] = [
  { id: 'tablet', name: 'Tablet', width: 768 },
  { id: 'phone', name: 'Phone', width: 390 }
];

export type ViewRead = { view: PageView; tree: PageTree };

export type ViewPlan = { view: PageView; item: PlanItem; root: RestNode };

export const viewsOf = (breakpoints: boolean): PageView[] => (breakpoints ? PAGE_VIEWS : []);

type Box = { x: number; y: number; width: number; height: number };

const unionOf = (boxes: Box[]): Box | null => {
  if (!boxes.length) {
    return null;
  }
  const [x, y] = [Math.min(...boxes.map((b) => b.x)), Math.min(...boxes.map((b) => b.y))];
  return { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x, height: Math.max(...boxes.map((b) => b.y + b.height)) - y };
};

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

const RUN = /^([^~]*)(?:~(\d+))?/;

const runOf = (key: string) => key.match(RUN)!;

function runsOf(children: RestNode[]): Map<string, Set<string>> {
  const runs = new Map<string, Set<string>>();
  for (const key of children.flatMap((c) => (c.key ? [c.key] : []))) {
    const [, element, run = ''] = runOf(key);
    runs.set(element, (runs.get(element) ?? new Set()).add(run));
  }
  return runs;
}

function joinedLines(n: RestNode): RestNode {
  if (!n.children?.length) {
    return n;
  }
  const runs: RestNode[][] = [];
  const elements = runsOf(n.children);
  const alone = (para: string) => (elements.get(runOf(para)[1])?.size ?? 0) <= 1;
  for (const c of n.children.map(joinedLines)) {
    const last = runs[runs.length - 1];
    const para = paragraphOf(c);
    if (para && last && paragraphOf(last[0]) === para && alone(para)) {
      last.push(c);
      continue;
    }
    runs.push([c]);
  }
  return { ...n, children: runs.map((run) => (run.length > 1 ? joined(run, paragraphOf(run[0])!) : run[0])) };
}

export const joinedTree = (tree: PageTree): PageTree => ({ ...tree, root: joinedLines(tree.root) });

const keyedNodes = (n: RestNode, into: RestNode[] = []): RestNode[] => {
  if (n.key) {
    into.push(n);
  }
  (n.children ?? []).forEach((c) => keyedNodes(c, into));
  return into;
};

export function narrowCuts(base: RestNode, narrow: RestNode, tops: number[]): number[] {
  const there = new Map(keyedNodes(narrow).map((n) => [n.key!, n.absoluteBoundingBox!.y]));
  const placed = keyedNodes(base).flatMap((n) => (there.has(n.key!) ? [{ y: n.absoluteBoundingBox!.y, at: there.get(n.key!)! }] : []));
  const bottom = narrow.absoluteBoundingBox!.y + narrow.absoluteBoundingBox!.height;
  return tops.map((top, i) => (i ? Math.min(bottom, ...placed.filter((p) => p.y >= top).map((p) => p.at)) : narrow.absoluteBoundingBox!.y)).map((cut, i, all) => Math.max(cut, ...all.slice(0, i)));
}

const nodesById = (n: RestNode, into = new Map<string, RestNode>()): Map<string, RestNode> => {
  into.set(n.id, n);
  (n.children ?? []).forEach((c) => nodesById(c, into));
  return into;
};

function clipKeys(item: PlanItem, root: RestNode): Map<string, string> {
  const nodes = nodesById(root);
  return new Map(
    Object.entries(item.keys ?? {}).flatMap(([ref, clipId]) => {
      const key = nodes.get(ref)?.key;
      return key ? [[clipId, key] as const] : [];
    })
  );
}

const PRECOMP = 'Precomp';
const LAYOUT_PROPS = new Set(['x', 'y', 'width', 'height', 'size', 'lineHeight', 'letterSpacing', 'axes', 'align', 'sizing', 'textWrap', 'path']);
type Snapshots = (clipId: string) => string[];

const snapshotsIn = (images: FigmaImage[]): Snapshots => {
  const grouped = Map.groupBy(
    images.filter((i) => i.fit === PictureFit.Stretch),
    (i) => i.clipId
  );
  return (id) => (grouped.get(id) ?? []).map((i) => i.hash);
};

type Scope = { byId: Map<string, MotionClip>; order: Map<string, number>; kids: Map<string | null, MotionClip[]>; keys: Map<string, string>; identities: Map<string, string>; snapshots: Snapshots; page: string | null; surface: string | null; size: { width: number; height: number } };

const BELOW = '>';

function identitiesOf(kids: Map<string | null, MotionClip[]>, keys: Map<string, string>, surface: string | null): Map<string, string> {
  const identities = new Map(keys);
  const visit = (parent: string | null, above: string) => {
    const seen = new Map<string, number>();
    const trailOf = (clip: MotionClip) => {
      const kind = `${clip.component}:${clip.name}`;
      const nth = seen.get(kind) ?? 0;
      seen.set(kind, nth + 1);
      return `${above}${BELOW}${kind}#${nth}`;
    };
    for (const clip of kids.get(parent) ?? []) {
      const trail = keys.get(clip.id) ?? trailOf(clip);
      if (clip.id !== surface) {
        identities.set(clip.id, trail);
      }
      visit(clip.id, trail);
    }
  };
  visit(null, '');
  return identities;
}

function scopeOf(doc: MotionDoc, keys: Map<string, string>, images: FigmaImage[], page: string | null): Scope {
  const clips = doc.tracks.flatMap((t) => t.clips) as MotionClip[];
  const byId = new Map(clips.map((c) => [c.id, c]));
  const kids = Map.groupBy(clips, (c) => (c.parent && byId.has(c.parent) ? c.parent : null));
  return { byId, order: new Map(clips.map((c, i) => [c.id, i])), kids, keys, identities: identitiesOf(kids, keys, doc.surface ?? null), snapshots: snapshotsIn(images), page, surface: doc.surface ?? null, size: { width: doc.width, height: doc.height } };
}

const kidsOf = (scope: Scope, id: string | null) => scope.kids.get(id) ?? [];

const sameSnapshots = (base: Scope, a: MotionClip, read: Scope, b: MotionClip) => base.snapshots(a.id).join() === read.snapshots(b.id).join();

const wordsOf = (clip: MotionClip) => String(clip.props.text ?? '').replace(/\s+/g, ' ').trim();

const sameLayer = (base: Scope, a: MotionClip, read: Scope, b: MotionClip) => a.component !== PRECOMP && b.component === a.component && wordsOf(a) === wordsOf(b) && sameSnapshots(base, a, read, b);

function pairedAbove(scope: Scope, id: string, paired: (id: string) => boolean): string | null {
  const parent = scope.byId.get(id)?.parent;
  if (!parent || !scope.byId.has(parent)) {
    return null;
  }
  return paired(parent) ? parent : pairedAbove(scope, parent, paired);
}

function within(scope: Scope, id: string, ancestor: string | null): boolean {
  const parent = scope.byId.get(id)?.parent;
  if (!parent || !scope.byId.has(parent)) {
    return ancestor === null;
  }
  return parent === ancestor || within(scope, parent, ancestor);
}

function pairsOf(base: Scope, read: Scope): Map<string, string> {
  const byKey = Map.groupBy([...read.identities].map(([id, key]) => ({ id, key })), (e) => e.key);
  const used = new Set<string>();
  const pairs = new Map<string, string>();
  const pair = (b: string, r: string) => {
    pairs.set(b, r);
    used.add(r);
  };
  if (base.page && read.page) {
    pair(base.page, read.page);
  }
  const walk = (clip: MotionClip) => {
    const key = base.identities.get(clip.id);
    const above = pairedAbove(base, clip.id, (id) => pairs.has(id));
    const host = above === null ? null : pairs.get(above)!;
    const partner = key && !pairs.has(clip.id) ? (byKey.get(key) ?? []).find((e) => !used.has(e.id) && within(read, e.id, host) && PAIRS[identityOf(key)](base, clip, read, read.byId.get(e.id)!)) : undefined;
    if (partner) {
      pair(clip.id, partner.id);
    }
    kidsOf(base, clip.id).forEach(walk);
  };
  kidsOf(base, null).forEach(walk);
  return pairs;
}

const flows = (scope: Scope, clip: MotionClip) => Boolean(clip.parent && scope.byId.get(clip.parent)?.autoLayout);

const fixedItem = (clip: MotionClip, flowing: boolean): Partial<MotionClip> =>
  flowing || clip.autoLayout ? { layoutItem: { ...(clip.layoutItem ?? DEFAULT_LAYOUT_ITEM), ...(flowing ? { absolute: true } : {}), width: Sizing.Fixed, height: Sizing.Fixed } } : {};

const layoutOf = (from: MotionClip) => Object.fromEntries(Object.entries(from.props).filter(([k]) => LAYOUT_PROPS.has(k)));

const lookOf = ({ id: _id, parent: _parent, hidden: _hidden, layoutItem: _item, props, ...rest }: MotionClip) => JSON.stringify({ ...rest, props: Object.fromEntries(Object.entries(props).filter(([k]) => !LAYOUT_PROPS.has(k))) });

enum Identity {
  Element = 'element',
  Position = 'position'
}

const identityOf = (key: string) => (key.includes(BELOW) ? Identity.Position : Identity.Element);

const SAME_PX = 0.01;

const sizeOf = (scope: Scope, clip: MotionClip) => [Number(clip.props.width) * scope.size.width, Number(clip.props.height) * scope.size.height];

const sameSize = (base: Scope, a: MotionClip, read: Scope, b: MotionClip) => sizeOf(base, a).every((side, i) => Math.abs(side - sizeOf(read, b)[i]) <= SAME_PX);

const roundedBox = (scope: Scope, clip: MotionClip) => {
  const [width, height] = sizeOf(scope, clip);
  return uniformRadius(String(clip.props.path ?? ''), { width, height }) !== null;
};

const drawsAlike = (base: Scope, a: MotionClip, read: Scope, b: MotionClip) => sameSize(base, a, read, b) || !(roundedBox(base, a) || roundedBox(read, b));

const PAIRS: Record<Identity, (base: Scope, a: MotionClip, read: Scope, b: MotionClip) => boolean> = {
  [Identity.Element]: sameLayer,
  [Identity.Position]: (base, a, read, b) => sameLayer(base, a, read, b) && lookOf(a) === lookOf(b) && drawsAlike(base, a, read, b)
};

const boxOf = (clip: MotionClip): Box => {
  const p = clip.props as { x: number; y: number; width: number; height: number };
  return { x: p.x - p.width / 2, y: p.y - p.height / 2, width: p.width, height: p.height };
};

const centred = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2, width: b.width, height: b.height });

const WHOLE: Box = { x: 0, y: 0, width: 1, height: 1 };

function settled(base: Scope, read: Scope, pairs: Map<string, string>): Map<string, MotionClip> {
  const out = new Map<string, MotionClip>();
  const settle = (clip: MotionClip): Box | null => {
    if (clip.id === base.surface) {
      return null;
    }
    const kids = kidsOf(base, clip.id)
      .map(settle)
      .filter((b): b is Box => Boolean(b));
    const partner = read.byId.get(pairs.get(clip.id) ?? '');
    const page = clip.id === base.page;
    const reach = page ? WHOLE : partner ? boxOf(partner) : unionOf(kids);
    if (!reach) {
      out.set(clip.id, { ...clip, hidden: true });
      return null;
    }
    out.set(clip.id, { ...clip, hidden: Boolean(partner?.hidden), props: { ...clip.props, ...(partner ? layoutOf(partner) : {}), ...centred(reach) }, ...fixedItem(clip, flows(base, clip)) });
    return reach;
  };
  kidsOf(base, null).forEach(settle);
  return out;
}

const copyId = (view: string, id: string) => `${view}:${id}`;

const LAST = '';

enum Side {
  Before = 'before',
  After = 'after'
}

const slotAt = (side: Side, id: string) => `${side}:${id}`;

type Copies = { clips: MotionClip[]; slots: Map<string, MotionClip[]>; images: FigmaImage[]; comps: MotionDoc['comps']; keys: [string, string][] };

function ownedIn(read: Scope, paired: Set<string>): Set<string> {
  const own = new Set<string>();
  const visit = (clip: MotionClip): boolean => {
    const kids = kidsOf(read, clip.id).map(visit);
    const mine = !paired.has(clip.id) && (read.keys.has(clip.id) || !kids.length || kids.some(Boolean));
    if (mine) {
      own.add(clip.id);
    }
    return mine;
  };
  kidsOf(read, null).forEach(visit);
  return own;
}

const withComp = (clip: MotionClip, view: string): MotionClip => (clip.props.comp ? { ...clip, props: { ...clip.props, comp: copyId(view, String(clip.props.comp)) } } : clip);

function compsCopied(doc: MotionDoc, ids: string[], view: string, into: MotionDoc['comps'] = {}): MotionDoc['comps'] {
  for (const id of ids) {
    const comp = doc.comps[id];
    if (!comp || into[copyId(view, id)]) {
      continue;
    }
    const clips = comp.tracks.flatMap((t) => t.clips as MotionClip[]);
    into[copyId(view, id)] = { ...comp, tracks: comp.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => withComp(c, view)) })) } as MotionDoc['comps'][string];
    compsCopied(
      doc,
      clips.flatMap((c) => (c.props.comp ? [String(c.props.comp)] : [])),
      view,
      into
    );
  }
  return into;
}

function copiesOf(view: string, read: Scope, readDoc: MotionDoc, readImages: FigmaImage[], pairs: Map<string, string>, base: Scope): Copies {
  const partnerOf = new Map([...pairs].map(([b, r]) => [r, b]));
  const own = ownedIn(read, new Set([...partnerOf.keys(), ...(read.surface ? [read.surface] : [])]));
  const slots = new Map<string, MotionClip[]>();
  const slotOf = new Map<string, string>();
  const clips: MotionClip[] = [];
  let waiting: MotionClip[] = [];
  const settle = (next: string | null) => {
    for (const copy of waiting) {
      const parent = copy.parent ?? null;
      const above = parent !== null && (next === null || (base.order.get(parent) ?? -1) >= (base.order.get(next) ?? -1));
      const slot = parent && slotOf.has(parent) ? slotOf.get(parent)! : above ? slotAt(Side.After, parent!) : next ? slotAt(Side.Before, next) : LAST;
      slotOf.set(copy.id, slot);
      slots.set(slot, [...(slots.get(slot) ?? []), copy]);
    }
    waiting = [];
  };
  for (const clip of readDoc.tracks.flatMap((t) => t.clips) as MotionClip[]) {
    if (partnerOf.has(clip.id)) {
      settle(partnerOf.get(clip.id)!);
      continue;
    }
    if (!own.has(clip.id)) {
      continue;
    }
    const parent = clip.parent ? (partnerOf.get(clip.parent) ?? (own.has(clip.parent) ? copyId(view, clip.parent) : null)) : null;
    const flowing = Boolean(parent && base.byId.get(parent)?.autoLayout);
    const { autoLayout: _flow, layoutItem: _item, ...rest } = withComp(clip, view);
    const copy = { ...rest, id: copyId(view, clip.id), parent, ...(flowing ? { layoutItem: { ...DEFAULT_LAYOUT_ITEM, absolute: true } } : {}) } as MotionClip;
    clips.push(copy);
    waiting.push(copy);
  }
  settle(null);
  const comps = compsCopied(
    readDoc,
    [...own].flatMap((id) => (read.byId.get(id)?.props.comp ? [String(read.byId.get(id)!.props.comp)] : [])),
    view
  );
  const inner = new Set(Object.values(comps).flatMap((c) => c.tracks.flatMap((t) => t.clips.map((k) => k.id))));
  const images = readImages.flatMap((i) => (own.has(i.clipId) ? [{ ...i, clipId: copyId(view, i.clipId) }] : inner.has(i.clipId) ? [i] : []));
  const keys = [...own].flatMap((id) => (read.keys.has(id) ? [[copyId(view, id), read.keys.get(id)!] as [string, string]] : []));
  return { clips, slots, images, comps, keys };
}

function placedTracks(doc: MotionDoc, settledClips: Map<string, MotionClip>, slots: Map<string, MotionClip[]>): MotionDoc['tracks'] {
  const at = (side: Side, id: string) => slots.get(slotAt(side, id)) ?? [];
  const tail = slots.get(LAST) ?? [];
  return doc.tracks.map((t, i) => ({ ...t, clips: [...(t.clips as MotionClip[]).flatMap((c) => [...at(Side.Before, c.id), settledClips.get(c.id) ?? c, ...at(Side.After, c.id)]), ...(i ? [] : tail)] })) as MotionDoc['tracks'];
}

const shownOnlyAt = (clip: MotionClip, view: string): MotionClip => ({ ...clip, hidden: true, ...(clip.hidden ? {} : { overrides: { [view]: { hidden: false } } }) });

export const viewOnly = (clip: MotionClip) => Boolean(clip.hidden) && Object.values(clip.overrides ?? {}).some((o) => o.hidden === false);

type State = { doc: MotionDoc; images: FigmaImage[]; keys: Map<string, string>; page: string | null };

const fontsJoined = (base: MotionDoc['fonts'], read: MotionDoc['fonts']): MotionDoc['fonts'] => [...base, ...read.filter((face) => !base.some((f) => f.family === face.family))];

function viewed(state: State, plan: ViewPlan): State {
  const { view, item } = plan;
  const added = addBreakpoint(state.doc, { name: view.name, width: item.doc.width, height: item.doc.height }, view.id);
  if (!added.ok) {
    return state;
  }
  const resolved = resolveAt(added.doc, view.id);
  const base = scopeOf(resolved, state.keys, state.images, state.page);
  const read = scopeOf(item.doc, clipKeys(item, plan.root), item.images, item.keys?.[plan.root.id] ?? null);
  const pairs = pairsOf(base, read);
  const copies = copiesOf(view.id, read, item.doc, item.images, pairs, base);
  const wanted = { ...resolved, tracks: placedTracks(resolved, settled(base, read, pairs), copies.slots), comps: { ...resolved.comps, ...copies.comps } } as MotionDoc;
  const lifted = liftEdit(added.doc, view.id, wanted);
  const copied = new Set(copies.clips.map((c) => c.id));
  const doc = { ...lifted, fonts: fontsJoined(lifted.fonts, item.doc.fonts), tracks: lifted.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (copied.has(c.id) ? shownOnlyAt(c, view.id) : c)) })) } as MotionDoc;
  return { doc, images: [...state.images, ...copies.images], keys: new Map([...state.keys, ...copies.keys]), page: state.page };
}

export function withViews(item: PlanItem, root: RestNode, plans: ViewPlan[]): PlanItem {
  if (!plans.length) {
    return item;
  }
  const start: State = { doc: item.doc, images: item.images, keys: clipKeys(item, root), page: item.keys?.[root.id] ?? null };
  const done = plans.reduce(viewed, start);
  return { ...item, doc: done.doc, images: done.images };
}
