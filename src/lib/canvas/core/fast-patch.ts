import { ItemKind, type DisplayList, type GroupItem, type Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { clipsOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { TrackKind } from '@feega/motion-core/motion/components';
import { traceSince } from './edit-trace';
import { ParentOpacity, ancestorsOf } from '@feega/motion-core/motion/parent';
import { laidSubtree, relaidWithin, withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import type { TextMeasure } from '@feega/motion-core/motion/layout/text-extent';
import { withoutHidden } from '@feega/motion-core/motion/organize';
import { SEPARATOR } from '@feega/motion-core/motion/precomp';
import { paintBleed } from '@feega/motion-core/motion/effects/paint-area';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { isText } from '@feega/motion-core/motion/layout/text-extent';
import { mattePairs } from '@feega/motion-core/motion/matte';
import type { BrandTokens } from '@feega/motion-core/motion/brand';
import type { Typeset } from '@feega/motion-core/motion/gpu-full/text/painter';

export type Look = { tokens: BrandTokens; assets: Record<string, string>; frame: number; typeset?: Typeset };

type Shift = readonly [number, number];

type Slide = { by: Shift; carried: Shift };

type Plan = { gone: ReadonlySet<string>; slides: ReadonlyMap<string, Slide>; cut: ReadonlySet<string> };

const changedKeys = <T extends object>(a: T, b: T): string[] => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k as keyof T] !== b[k as keyof T]);

const OPAQUE = 1;

const ownContent = (group: GroupItem): boolean => group.items.every((i) => i.clip === group.clip && (i.kind !== ItemKind.Group || ownContent(i)));

function faded(items: Item[], owned: ReadonlySet<string>, ratio: number): Item[] | null {
  const out: Item[] = [];
  for (const item of items) {
    if (!owned.has(item.clip)) {
      const inner = item.kind === ItemKind.Group ? faded(item.items, owned, ratio) : null;
      if (item.kind === ItemKind.Group && !inner) {
        return null;
      }
      out.push(inner && item.kind === ItemKind.Group ? { ...item, items: inner } : item);
      continue;
    }
    if (item.kind === ItemKind.Group && !ownContent(item)) {
      return null;
    }
    out.push({ ...item, opacity: item.opacity * ratio });
  }
  return out;
}

function fadeOf(list: DisplayList, doc: MotionDoc, a: MotionClip, b: MotionClip): DisplayList | null {
  const was = Number(a.transform.opacity ?? OPAQUE);
  const now = Number(b.transform.opacity ?? OPAQUE);
  if (!(was > 0) || a.keyframes.opacity) {
    return null;
  }
  const below = clipsOf(doc).filter((c) => ancestorsOf(doc, c.id).includes(b.id));
  if (below.some((c) => c.parentOpacity !== ParentOpacity.Inherit)) {
    return null;
  }
  const items = faded(list.items, new Set([b.id, ...below.map((c) => c.id)]), now / was);
  return items ? { ...list, items } : null;
}

enum Unpatchable {
  Resized = 'resized',
  Reposed = 'reposed',
  Restyled = 'restyled',
  Instance = 'instance',
  Animated = 'animated',
  Turned = 'turned',
  Parent = 'parent',
  Pinned = 'pinned'
}

enum Laying {
  Kept = 'kept',
  Relaid = 'relaid'
}

type Change = { doc: MotionDoc; laying: Laying; a: MotionClip; b: MotionClip | null };

const SLIDES = new Set(['x', 'y']);

const POSED_ONLY = new Set(['x', 'y', 'opacity']);

const slidOnly = (keys: string[]) => keys.every((k) => SLIDES.has(k));

function posedStill(doc: MotionDoc, id: string): boolean {
  const clip = clipsOf(doc).find((c) => c.id === id);
  return !!clip && !Object.keys(clip.keyframes).length && Object.keys(clip.transform).every((k) => POSED_ONLY.has(k));
}

const UNPATCHABLE: Record<Unpatchable, (c: Change) => boolean> = {
  [Unpatchable.Resized]: ({ a, b }) => !!b && !slidOnly(changedKeys(a.props, b.props)),
  [Unpatchable.Reposed]: ({ a, b }) => !!b && !slidOnly(changedKeys(a.transform, b.transform)),
  [Unpatchable.Restyled]: ({ a, b }) => !!b && changedKeys(a, b).some((k) => k !== 'props' && k !== 'transform'),
  [Unpatchable.Instance]: ({ a }) => a.component === 'Precomp',
  [Unpatchable.Animated]: ({ a, b }) => !!b && !!(a.keyframes.x || a.keyframes.y),
  [Unpatchable.Turned]: ({ doc, a, b }) => !!b && a.transform !== b.transform && !ancestorsOf(doc, b.id).every((id) => posedStill(doc, id)),
  [Unpatchable.Parent]: ({ doc, a, b }) => !b && clipsOf(doc).some((c) => c.parent === a.id),
  [Unpatchable.Pinned]: ({ laying, a }) => laying === Laying.Relaid && !!a.layoutItem?.absolute
};

const unpatchable = (change: Change) => Object.values(UNPATCHABLE).some((rule) => rule(change));

type Clips = Map<string, MotionClip>;

type Pairing = { laying: Laying; was: (id: string) => MotionClip | undefined; now: (id: string) => MotionClip | undefined; touched: readonly string[]; carry: (laidBefore: Clips, plan: Plan) => Clips };

const byId = (clips: MotionClip[]) => new Map(clips.map((c) => [c.id, c]));

const shownClips = new WeakMap<MotionDoc, Map<string, MotionClip>>();

const shown = (doc: MotionDoc) => shownClips.get(doc) ?? shownClips.set(doc, byId(clipsOf(withoutHidden(doc)))).get(doc)!;

const laidDocs = new WeakMap<MotionDoc, Map<TextMeasure, Clips>>();

const laidOf = (doc: MotionDoc) => laidDocs.get(doc) ?? laidDocs.set(doc, new Map()).get(doc)!;

function laid(doc: MotionDoc, measure: TextMeasure): Clips {
  const byMeasure = laidOf(doc);
  return byMeasure.get(measure) ?? byMeasure.set(measure, exactDocs.get(doc)?.get(measure) ?? byId(clipsOf(withAutoLayout(withoutHidden(doc), measure)))).get(measure)!;
}

function carryLaid(before: MotionDoc, after: MotionDoc, measure: TextMeasure, carry: (laidBefore: Clips) => Clips) {
  const laidBefore = laidOf(before).get(measure);
  if (laidBefore) {
    laidOf(after).set(measure, carry(laidBefore));
  }
}

function replaced(laidBefore: Clips, plan: Plan, changed: Iterable<[string, MotionClip]>): Clips {
  const next = new Map(laidBefore);
  plan.gone.forEach((id) => next.delete(id));
  for (const [id, clip] of changed) {
    next.set(id, clip);
  }
  return next;
}

function unlaid(before: MotionDoc, after: MotionDoc): Pairing {
  const [was, now] = [shown(before), shown(after)];
  const touched = [...was.keys()];
  const restyled = (laidBefore: Clips, id: string): [string, MotionClip][] => {
    const [a, b, at] = [was.get(id), now.get(id), laidBefore.get(id)];
    return a && b && at && a !== b ? [[id, { ...at, transform: b.transform }]] : [];
  };
  return { laying: Laying.Kept, was: (id) => was.get(id), now: (id) => now.get(id), touched, carry: (laidBefore, plan) => replaced(laidBefore, plan, touched.flatMap((id) => restyled(laidBefore, id))) };
}

function relaidParent(before: MotionDoc, after: MotionDoc, edited: MotionClip, measure: TextMeasure): Pairing | null {
  const was = laid(before, measure);
  const container = was.get(edited.parent ?? '');
  if (!container) {
    return null;
  }
  const relaid = byId(relaidWithin(withoutHidden(after), container, measure));
  const now = (id: string) => (id === edited.id && edited.hidden ? undefined : (relaid.get(id) ?? was.get(id)));
  return { laying: Laying.Relaid, was: (id) => was.get(id), now, touched: [edited.id, ...relaid.keys()], carry: (laidBefore, plan) => replaced(laidBefore, plan, relaid) };
}

function hidePairing(before: MotionDoc, after: MotionDoc, edited: MotionClip, measure: TextMeasure): Pairing | null {
  const parent = clipsOf(after).find((c) => c.id === edited.parent);
  return parent?.autoLayout ? relaidParent(before, after, edited, measure) : unlaid(before, after);
}

const shiftOf = (from: Record<string, unknown>, to: Record<string, unknown>, doc: MotionDoc): Shift => [(Number(to.x ?? 0) - Number(from.x ?? 0)) * doc.width, (Number(to.y ?? 0) - Number(from.y ?? 0)) * doc.height];

const sum = (a: Shift, b: Shift | undefined): Shift => (b ? [a[0] + b[0], a[1] + b[1]] : a);

const moves = ([x, y]: Shift) => x !== 0 || y !== 0;

function planOf(after: MotionDoc, { laying, was, now, touched }: Pairing): Plan | null {
  const gone = new Set<string>();
  const own = new Map<string, Shift>();
  const carried = new Map<string, Shift>();
  for (const id of touched) {
    const a = was(id);
    const b = now(id) ?? null;
    if (!a || a === b) {
      continue;
    }
    if (unpatchable({ doc: after, laying, a, b })) {
      return null;
    }
    if (!b) {
      gone.add(id);
      continue;
    }
    own.set(id, shiftOf(a.props, b.props, after));
    const along = shiftOf(a.transform, b.transform, after);
    if (moves(along)) {
      carried.set(id, along);
    }
  }
  const reached = carried.size ? clipsOf(after).filter((c) => ancestorsOf(after, c.id).some((at) => carried.has(at))).map((c) => c.id) : [];
  const slides = new Map<string, Slide>();
  for (const id of new Set([...own.keys(), ...carried.keys(), ...reached])) {
    const along = ancestorsOf(after, id).reduce<Shift>((s, at) => sum(s, carried.get(at)), sum([0, 0], carried.get(id)));
    const by = sum(along, own.get(id));
    if (moves(by)) {
      slides.set(id, { by, carried: along });
    }
  }
  const cut = new Set([...own.keys()].filter((id) => moves(own.get(id)!) && now(id)?.clipContent));
  return { gone, slides, cut };
}

const slid = (m: readonly number[], [x, y]: Shift) => [m[0], m[1], m[2], m[3], m[4] + x, m[5] + y];

type Ctx = { plan: Plan; masked: (clip: string) => boolean; ownMask: (clip: string) => boolean };

function shiftedItem(item: Item, { by, carried }: Slide, ctx: Ctx): Item | null {
  if (item.scissor || (item.masks && ctx.ownMask(item.clip))) {
    return null;
  }
  const matte = item.matte ? replanned(item.matte.items, ctx) : null;
  if (item.matte && !matte) {
    return null;
  }
  const base = { ...item, ...(item.origin ? { origin: [item.origin[0] + carried[0], item.origin[1] + carried[1]] } : {}), ...(item.matte ? { matte: { ...item.matte, items: matte } } : {}) };
  if (item.kind === ItemKind.Group) {
    const inner = replanned(item.items, ctx);
    return inner ? ({ ...base, items: inner } as Item) : null;
  }
  return { ...base, matrix: slid(item.matrix, by) } as Item;
}

function replanned(items: Item[], ctx: Ctx): Item[] | null {
  const out: Item[] = [];
  for (const item of items) {
    if (ctx.plan.gone.has(item.clip)) {
      continue;
    }
    if ((item.masks && ctx.masked(item.clip)) || ctx.plan.slides.has(instanceHost(item.clip) ?? '')) {
      return null;
    }
    const slide = ctx.plan.slides.get(item.clip);
    const next = slide ? shiftedItem(item, slide, ctx) : item.kind === ItemKind.Group ? withItems(item, replanned(item.items, ctx)) : item;
    if (!next) {
      return null;
    }
    out.push(next);
  }
  return out;
}

const instanceHost = (clip: string): string | null => (clip.includes(SEPARATOR) ? clip.split(SEPARATOR)[0] : null);

const withItems = (group: GroupItem, items: Item[] | null): Item | null => (items ? { ...group, items } : null);

function onlyClip(before: MotionDoc, after: MotionDoc): [MotionClip, MotionClip] | null {
  if (changedKeys(before, after).some((k) => k !== 'tracks')) {
    return null;
  }
  const [was, now] = [clipsOf(before), clipsOf(after)];
  if (was.length !== now.length || was.some((c, i) => c.id !== now[i].id)) {
    return null;
  }
  const edited = now.flatMap((c, i) => (c === was[i] ? [] : [i]));
  return edited.length === 1 ? [was[edited[0]], now[edited[0]]] : null;
}

const sameJson = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function relinkedClip(was: MotionClip | undefined, now: MotionClip): MotionClip {
  if (!was || sameJson(was, now)) {
    return was ?? now;
  }
  return Object.fromEntries(Object.entries(now).map(([k, v]) => [k, sameJson((was as never)[k], v) ? (was as never)[k] : v])) as unknown as MotionClip;
}

function relinkedTrack(was: MotionDoc['tracks'][number] | undefined, now: MotionDoc['tracks'][number]): MotionDoc['tracks'][number] {
  if (!was) {
    return now;
  }
  const old = new Map(was.clips.map((c) => [c.id, c]));
  const clips = now.clips.map((c) => relinkedClip(old.get(c.id), c));
  const { clips: _was, ...wasRest } = was;
  const { clips: _now, ...nowRest } = now;
  const same = clips.length === was.clips.length && clips.every((c, i) => c === was.clips[i]) && sameJson(wasRest, nowRest);
  return same ? was : { ...now, clips };
}

export const reloaded = (before: MotionDoc, after: MotionDoc): boolean => {
  const [was, now] = [clipsOf(before), clipsOf(after)];
  return was.length > 0 && was.length === now.length && was[0] !== now[0] && was.at(-1) !== now.at(-1);
};

export function relinked(before: MotionDoc, after: MotionDoc): MotionDoc {
  const tracks = new Map(before.tracks.map((t) => [t.id, t]));
  const fields = Object.fromEntries(Object.entries(after).map(([k, v]) => [k, k === 'tracks' ? after.tracks.map((t) => relinkedTrack(tracks.get(t.id), t)) : sameJson((before as never)[k], v) ? (before as never)[k] : v]));
  return fields as unknown as MotionDoc;
}

const MANY_CLIPS = 'many';

export function editKindOf(before: MotionDoc, after: MotionDoc): string {
  const pair = onlyClip(before, after);
  return (pair && EDIT_OF.find(([, is]) => is(pair[0], pair[1]))?.[0]) ?? MANY_CLIPS;
}

export const editedClipId = (before: MotionDoc, after: MotionDoc): string | null => onlyClip(before, after)?.[1].id ?? null;

function rebled(list: DisplayList, before: MotionDoc, after: MotionDoc): DisplayList | null {
  const { bleed: was = 0, ...rest } = list;
  if (paintBleed(withoutHidden(before)) !== was) {
    return null;
  }
  const now = paintBleed(withoutHidden(after));
  return now ? { ...rest, bleed: now } : rest;
}

function relaid(list: DisplayList, before: MotionDoc, after: MotionDoc, measure: TextMeasure, pairing: Pairing | null): DisplayList | null {
  const plan = pairing && planOf(after, pairing);
  if (!plan) {
    return null;
  }
  carryLaid(before, after, measure, (laidBefore) => pairing.carry(laidBefore, plan));
  const masked = (clip: string) => ancestorsOf(after, clip).some((id) => plan.cut.has(id));
  const ownMask = (clip: string) => !!pairing.now(clip)?.mask;
  const items = replanned(list.items, { plan, masked, ownMask });
  if (!items) {
    return null;
  }
  const patched = { ...list, items, unsupported: list.unsupported.filter((g) => !plan.gone.has(g.clip)) };
  return plan.gone.size ? rebled(patched, before, after) : patched;
}

const STATIC_KEYS = new Set(['props', 'layoutItem']);

const keptOnly = (doc: MotionDoc, ids: ReadonlySet<string>): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => ids.has(c.id)) })) });

const alone = (doc: MotionDoc, clip: MotionClip): boolean => {
  const all = clipsOf(doc);
  const chain = ancestorsOf(doc, clip.id).map((id) => all.find((c) => c.id === id));
  const pairs = mattePairs(doc).some((p) => p.target === clip.id || p.source === clip.id);
  return !isText(clip.component) && clip.component !== 'Precomp' && !pairs && !Object.keys(clip.keyframes).length && !all.some((c) => c.parent === clip.id) && chain.every((c) => c && !c.autoLayout && !Object.keys(c.keyframes).length);
};

const drawsFor = (item: Item, clip: string) => item.clip === clip || item.clip.startsWith(`${clip}${SEPARATOR}`);

function spliced(items: Item[], clip: string, fresh: Item[]): Item[] | null {
  const at = items.findIndex((i) => drawsFor(i, clip));
  if (at >= 0) {
    const end = at + items.slice(at).findIndex((i) => !drawsFor(i, clip));
    const stop = end < at ? items.length : end;
    return items.slice(stop).some((i) => drawsFor(i, clip)) ? null : [...items.slice(0, at), ...fresh, ...items.slice(stop)];
  }
  const holder = items.findIndex((i) => i.kind === ItemKind.Group && holds(i, clip));
  if (holder < 0) {
    return null;
  }
  const group = items[holder] as GroupItem;
  const inner = spliced(group.items, clip, fresh);
  return inner && [...items.slice(0, holder), { ...group, items: inner }, ...items.slice(holder + 1)];
}

const holds = (group: GroupItem, clip: string): boolean => group.items.some((i) => drawsFor(i, clip) || (i.kind === ItemKind.Group && holds(i, clip)));

function ownItems(items: Item[], clip: string): Item[] {
  const direct = items.filter((i) => drawsFor(i, clip));
  return direct.length ? direct : items.flatMap((i) => (i.kind === ItemKind.Group ? ownItems(i.items, clip) : []));
}

function redrawn(list: DisplayList, after: MotionDoc, b: MotionClip, look: Look | undefined): DisplayList | null {
  if (!look || !alone(after, b)) {
    return null;
  }
  const kept = new Set([b.id, ...ancestorsOf(after, b.id), ...(after.surface ? [after.surface] : [])]);
  const fresh = ownItems(drawFrame(prepare(keptOnly(after, kept), look.tokens, look.assets, look.typeset), look.frame).items, b.id);
  const items = fresh.length ? spliced(list.items, b.id, fresh) : null;
  return items && { ...list, items };
}

const sameProps = (a: MotionClip, b: MotionClip) => a === b || (a.transform === b.transform && changedKeys(a.props, b.props).length === 0);

const settled = (c: MotionClip): MotionClip => {
  const { autoLayout: _layout, ...rest } = c;
  return rest as MotionClip;
};

const below = (doc: MotionDoc, ids: ReadonlySet<string>) => clipsOf(doc).filter((c) => ids.has(c.id) || ancestorsOf(doc, c.id).some((id) => ids.has(id))).map((c) => c.id);

const exactDocs = new WeakMap<MotionDoc, Map<TextMeasure, Clips>>();

function exactLaid(doc: MotionDoc, measure: TextMeasure): Clips {
  const byMeasure = exactDocs.get(doc) ?? exactDocs.set(doc, new Map()).get(doc)!;
  return byMeasure.get(measure) ?? byMeasure.set(measure, byId(clipsOf(withAutoLayout(withoutHidden(doc), measure)))).get(measure)!;
}

const REDRAW_MOST = 48;

const SLIDING = new Set(['x', 'y']);

function slideOf(a: MotionClip | undefined, b: MotionClip | undefined, doc: MotionDoc): Shift | null {
  if (!a || !b || !sameJson(a.transform, b.transform) || !changedKeys(a.props, b.props).every((k) => SLIDING.has(k))) {
    return null;
  }
  return shiftOf(a.props, b.props, doc);
}

const plainToSlide = (item: Item): boolean => !item.masks && !item.matte && !item.scissor && (item.kind !== ItemKind.Group || item.items.every(plainToSlide));

function slidItem(item: Item, by: Shift): Item {
  if (item.kind === ItemKind.Group) {
    return { ...item, items: item.items.map((i) => slidItem(i, by)) };
  }
  return { ...item, matrix: slid(item.matrix, by) } as Item;
}

const rootOf = (doc: MotionDoc, id: string) => ancestorsOf(doc, id)[0] ?? id;

export function laidIncrementally(before: MotionDoc, after: MotionDoc, measure: TextMeasure): Clips {
  const byMeasure = exactDocs.get(after) ?? exactDocs.set(after, new Map()).get(after)!;
  const known = byMeasure.get(measure);
  if (known) {
    return known;
  }
  const was = exactLaid(before, measure);
  const [old, now] = [clipsOf(before), clipsOf(after)];
  const oldById = new Map(old.map((c) => [c.id, c]));
  const touched = now.filter((c) => oldById.get(c.id) !== c).map((c) => c.id);
  const kept = new Set(now.map((c) => c.id));
  const gone = old.filter((c) => !kept.has(c.id)).map((c) => c.id);
  const shown = withoutHidden(after);
  const left = new Set(clipsOf(shown).map((c) => c.id));
  const started = performance.now();
  const roots = new Set([...touched.map((id) => rootOf(after, id)), ...[...touched, ...gone].filter((id) => oldById.has(id)).map((id) => rootOf(before, id))]);
  const fresh = new Map([...roots].filter((id) => left.has(id)).flatMap((id) => laidSubtree(shown, id, measure).map((c) => [c.id, c] as const)));
  const next: Clips = new Map(clipsOf(shown).map((c) => [c.id, fresh.get(c.id) ?? was.get(c.id) ?? c]));
  byMeasure.set(measure, next);
  traceSince('patch:layout:root', started);
  return next;
}

const timed = <T>(name: string, run: () => T): T => {
  const start = performance.now();
  try {
    return run();
  } finally {
    traceSince(name, start);
  }
};

const drawOrder = (doc: MotionDoc): string[] => [...doc.tracks].reverse().filter((t) => t.kind === TrackKind.Visual && !t.hidden).flatMap((t) => t.clips.map((c) => c.id));

const hostOf = (item: Item) => instanceHost(item.clip) ?? item.clip;

function hostsWithin(item: Item, into: Set<string>) {
  if (item.kind !== ItemKind.Group) {
    return;
  }
  for (const inner of item.items) {
    into.add(hostOf(inner));
    hostsWithin(inner, into);
  }
}

function replacedRuns(items: Item[], fresh: ReadonlyMap<string, Item[]>, found: Set<string>, covered: Set<string>): Item[] | null {
  const out: Item[] = [];
  let changed = false;
  let open: string | null = null;
  for (const item of items) {
    const key = hostOf(item);
    if (fresh.has(key)) {
      changed = true;
      hostsWithin(item, covered);
      if (key === open) {
        continue;
      }
      if (found.has(key)) {
        return null;
      }
      found.add(key);
      open = key;
      out.push(...fresh.get(key)!);
      continue;
    }
    open = null;
    if (item.kind !== ItemKind.Group) {
      out.push(item);
      continue;
    }
    const inner = replacedRuns(item.items, fresh, found, covered);
    if (!inner) {
      return null;
    }
    changed ||= inner !== item.items;
    out.push(inner === item.items ? item : { ...item, items: inner });
  }
  return changed ? out : items;
}

function hostsIn(items: Item[], into = new Set<string>()): Set<string> {
  for (const item of items) {
    into.add(hostOf(item));
    hostsIn(item.kind === ItemKind.Group ? item.items : [], into);
  }
  return into;
}

function insertedAll(items: Item[], order: string[], fresh: ReadonlyMap<string, Item[]>): Item[] | null {
  if (!fresh.size) {
    return items;
  }
  const present = hostsIn(items);
  const before = new Map<string, Item[]>();
  let pending: Item[] = [];
  let last: string | null = null;
  for (const id of order) {
    if (fresh.has(id)) {
      pending.push(...fresh.get(id)!);
      continue;
    }
    if (!present.has(id)) {
      continue;
    }
    last = id;
    if (pending.length) {
      before.set(id, pending);
      pending = [];
    }
  }
  if (pending.length && !last) {
    return null;
  }
  const after = new Map(pending.length ? [[last!, pending]] : []);
  return placedAll(items, before, after, new Set());
}

function placedAll(items: Item[], before: ReadonlyMap<string, Item[]>, after: ReadonlyMap<string, Item[]>, used: Set<string>): Item[] {
  const out: Item[] = [];
  items.forEach((item, i) => {
    const key = hostOf(item);
    if (before.has(key) && !used.has(`<${key}`)) {
      used.add(`<${key}`);
      out.push(...before.get(key)!);
    }
    out.push(item.kind === ItemKind.Group ? { ...item, items: placedAll(item.items, before, after, used) } : item);
    const next = items[i + 1];
    if (after.has(key) && (!next || hostOf(next) !== key) && !used.has(`>${key}`)) {
      used.add(`>${key}`);
      out.push(...after.get(key)!);
    }
  });
  return out;
}

function slidAll(items: Item[], slides: ReadonlyMap<string, Shift>): Item[] {
  if (!slides.size) {
    return items;
  }
  return items.map((item) => {
    const by = slides.get(instanceHost(item.clip) ?? item.clip);
    if (by) {
      return slidItem(item, by);
    }
    return item.kind === ItemKind.Group ? { ...item, items: slidAll(item.items, slides) } : item;
  });
}

function withoutClips(items: Item[], gone: ReadonlySet<string>): Item[] {
  if (!gone.size) {
    return items;
  }
  return items.flatMap<Item>((item) => {
    if (gone.has(instanceHost(item.clip) ?? item.clip)) {
      return [];
    }
    return item.kind === ItemKind.Group ? [{ ...item, items: withoutClips(item.items, gone) }] : [item];
  });
}

const declined = (reason: string): null => {
  traceSince(`patch:decline:${reason}`, performance.now());
  return null;
};

function subtreeRedrawn(list: DisplayList, before: MotionDoc, after: MotionDoc, edited: MotionClip, measure: TextMeasure, look: Look | undefined): DisplayList | null {
  if (!look) {
    return declined('no-look');
  }
  const was = timed('patch:layout:before', () => exactLaid(before, measure));
  const relaid = timed('patch:layout:after', () => laidIncrementally(before, after, measure));
  let mark = performance.now();
  const moved = new Set([edited.id, ...[...relaid].filter(([id, c]) => !was.get(id) || !sameProps(was.get(id)!, c)).map(([id]) => id)]);
  const slides = new Map([...moved].flatMap((id) => {
    const by = id === edited.id ? null : slideOf(was.get(id), relaid.get(id), after);
    return by && ownItems(list.items, id).every(plainToSlide) ? [[id, by] as const] : [];
  }));
  const cutting = new Set([...slides.keys()].filter((id) => !!relaid.get(id)?.clipContent || !!relaid.get(id)?.mask));
  const redraw = [...below(after, new Set([edited.id, ...cutting])), ...[...moved].filter((id) => !slides.has(id) && id !== edited.id)].filter((id, i, all) => all.indexOf(id) === i);
  traceSince('patch:plan', mark);
  if (redraw.filter((id) => relaid.has(id)).length > REDRAW_MOST) {
    return declined('too-many');
  }
  const paired = new Set(mattePairs(after).flatMap((p) => [p.source, p.target]));
  if (redraw.some((id) => paired.has(id))) {
    return declined('paired');
  }
  mark = performance.now();
  const now = (c: MotionClip) => settled(relaid.get(c.id) ?? was.get(c.id) ?? c);
  const kept = new Set([...redraw, ...redraw.flatMap((id) => ancestorsOf(after, id)), ...(after.surface ? [after.surface] : [])]);
  const shown = withoutHidden(after);
  const mini = { ...shown, tracks: shown.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => kept.has(c.id)).map(now) })) };
  const back = new Set(redraw.filter((id) => relaid.has(id) && !was.has(id)));
  const redrawSet = new Set(redraw);
  traceSince('patch:mini', mark);
  const drawnMini = timed('patch:draw', () => drawFrame(prepare(mini, look.tokens, look.assets, look.typeset), look.frame));
  const fresh = drawnMini.items;
  mark = performance.now();
  const hiddenNow = new Set(redraw.filter((id) => !relaid.has(id)));
  let items: Item[] | null = timed('patch:splice:hidden', () => withoutClips(list.items, hiddenNow));
  const order = drawOrder(shown);
  const rank = (clip: string) => order.indexOf(instanceHost(clip) ?? clip);
  const loopAt = performance.now();
  const shownRedraw = redraw.filter((id) => !hiddenNow.has(id));
  traceSince(`patch:splice:count:${shownRedraw.length}`, loopAt);
  const owned = new Map(shownRedraw.map((id) => [id, ownItems(fresh, id)]));
  const found = new Set<string>();
  const covered = new Set<string>();
  items = replacedRuns(items, owned, found, covered);
  const missing = new Map(shownRedraw.filter((id) => !found.has(id) && !covered.has(id) && owned.get(id)!.length).map((id) => [id, owned.get(id)!]));
  items = items && insertedAll(items, order, missing);
  if (!items) {
    return declined('splice');
  }
  traceSince('patch:splice:redraw', loopAt);
  items = timed('patch:splice:slide', () => slidAll(items!, new Map([...slides].filter(([id]) => !redrawSet.has(id)))));
  traceSince('patch:splice', mark);
  mark = performance.now();
  const left = new Set(clipsOf(shown).map((c) => c.id));
  const gone = new Set(clipsOf(after).map((c) => c.id).filter((id) => !left.has(id)));
  const redrawn = new Set(redraw);
  const host = (g: DisplayList['unsupported'][number]) => instanceHost(g.clip) ?? g.clip;
  const steady = (g: DisplayList['unsupported'][number]) => redrawn.has(host(g)) && !back.has(host(g)) && !gone.has(host(g));
  if (JSON.stringify(list.unsupported.filter(steady)) !== JSON.stringify(drawnMini.unsupported.filter(steady))) {
    return declined('gaps');
  }
  const unsupported = drawnMini.unsupported.filter((g) => back.has(host(g))).reduce((all, g) => {
    const at = all.findIndex((k) => rank(k.clip) > rank(g.clip));
    return at < 0 ? [...all, g] : [...all.slice(0, at), g, ...all.slice(at)];
  }, list.unsupported.filter((g) => !gone.has(host(g))));
  traceSince('patch:gaps', mark);
  const patched = { ...list, items: items!, unsupported };
  return timed('patch:bleed', () => rebled(patched, before, after));
}

enum Edit {
  Fade = 'fade',
  Hide = 'hide',
  Move = 'move',
  Redraw = 'redraw',
  Show = 'show'
}

const EDIT_OF: [Edit, (a: MotionClip, b: MotionClip) => boolean][] = [
  [Edit.Fade, (a, b) => changedKeys(a, b).join() === 'transform' && changedKeys(a.transform, b.transform).join() === 'opacity'],
  [Edit.Hide, (a, b) => changedKeys(a, b).join() === 'hidden' && !a.hidden],
  [Edit.Show, (a, b) => changedKeys(a, b).join() === 'hidden' && !!a.hidden],
  [Edit.Move, (a, b) => changedKeys(a, b).join() === 'transform' && slidOnly(changedKeys(a.transform, b.transform))],
  [Edit.Redraw, (a, b) => changedKeys(a, b).every((k) => STATIC_KEYS.has(k))]
];

type Patch = (list: DisplayList, before: MotionDoc, after: MotionDoc, a: MotionClip, b: MotionClip, measure: TextMeasure, look?: Look) => DisplayList | null;

const PATCHES: Record<Edit, Patch> = {
  [Edit.Fade]: (list, _before, after, a, b) => fadeOf(list, after, a, b),
  [Edit.Hide]: (list, before, after, _a, b, measure, look) => subtreeRedrawn(list, before, after, b, measure, look) ?? relaid(list, before, after, measure, hidePairing(before, after, b, measure)),
  [Edit.Move]: (list, before, after, _a, _b, measure) => relaid(list, before, after, measure, unlaid(before, after)),
  [Edit.Show]: (list, before, after, _a, b, measure, look) => subtreeRedrawn(list, before, after, b, measure, look),
  [Edit.Redraw]: (list, before, after, _a, b, measure, look) => redrawn(list, after, b, look) ?? subtreeRedrawn(list, before, after, b, measure, look)
};

export function readyPatch(doc: MotionDoc, measure: TextMeasure): void {
  laid(doc, measure);
  exactLaid(doc, measure);
}

function restyledClips(before: MotionDoc, after: MotionDoc): MotionClip[] | null {
  if (changedKeys(before, after).some((k) => k !== 'tracks')) {
    return null;
  }
  const [was, now] = [clipsOf(before), clipsOf(after)];
  if (was.length !== now.length || was.some((c, i) => c.id !== now[i].id)) {
    return null;
  }
  const edited = now.filter((c, i) => c !== was[i]);
  return edited.length && edited.every((c) => changedKeys(was[now.indexOf(c)], c).every((k) => STATIC_KEYS.has(k))) ? edited : null;
}

function instanceOfEdit(before: MotionDoc, after: MotionDoc): MotionClip | null {
  if (before.tracks !== after.tracks || changedKeys(before, after).join() !== 'comps') {
    return null;
  }
  const edited = new Set(changedKeys(before.comps, after.comps));
  const hosts = clipsOf(after).filter((c) => c.component === 'Precomp' && edited.has(String(c.props.comp ?? '')));
  return hosts.length === 1 ? hosts[0] : null;
}

export function fastPatch(list: DisplayList, before: MotionDoc, after: MotionDoc, measure: TextMeasure, look?: Look): DisplayList | null {
  const pair = onlyClip(before, after);
  const host = pair ? null : instanceOfEdit(before, after);
  if (host) {
    return subtreeRedrawn(list, before, after, host, measure, look);
  }
  const many = pair ? null : restyledClips(before, after);
  if (many) {
    return subtreeRedrawn(list, before, after, many[0], measure, look);
  }
  const edit = pair && EDIT_OF.find(([, is]) => is(pair[0], pair[1]))?.[0];
  return pair && edit ? PATCHES[edit](list, before, after, pair[0], pair[1], measure, look) : null;
}
