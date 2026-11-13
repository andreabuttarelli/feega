import { ItemKind, type DisplayList, type GroupItem, type Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { clipsOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { ParentOpacity, ancestorsOf } from '@feega/motion-core/motion/parent';
import { relaidWithin, withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import type { TextMeasure } from '@feega/motion-core/motion/layout/text-extent';
import { withoutHidden } from '@feega/motion-core/motion/organize';
import { SEPARATOR } from '@feega/motion-core/motion/precomp';
import { paintBleed } from '@feega/motion-core/motion/effects/paint-area';

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
  return byMeasure.get(measure) ?? byMeasure.set(measure, byId(clipsOf(withAutoLayout(withoutHidden(doc), measure)))).get(measure)!;
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

enum Edit {
  Fade = 'fade',
  Hide = 'hide',
  Move = 'move'
}

const EDIT_OF: [Edit, (a: MotionClip, b: MotionClip) => boolean][] = [
  [Edit.Fade, (a, b) => changedKeys(a, b).join() === 'transform' && changedKeys(a.transform, b.transform).join() === 'opacity'],
  [Edit.Hide, (a, b) => changedKeys(a, b).join() === 'hidden' && !a.hidden],
  [Edit.Move, (a, b) => changedKeys(a, b).join() === 'transform' && slidOnly(changedKeys(a.transform, b.transform))]
];

type Patch = (list: DisplayList, before: MotionDoc, after: MotionDoc, a: MotionClip, b: MotionClip, measure: TextMeasure) => DisplayList | null;

const PATCHES: Record<Edit, Patch> = {
  [Edit.Fade]: (list, _before, after, a, b) => fadeOf(list, after, a, b),
  [Edit.Hide]: (list, before, after, _a, b, measure) => relaid(list, before, after, measure, hidePairing(before, after, b, measure)),
  [Edit.Move]: (list, before, after, _a, _b, measure) => relaid(list, before, after, measure, unlaid(before, after))
};

export function readyPatch(doc: MotionDoc, measure: TextMeasure): void {
  laid(doc, measure);
}

export function fastPatch(list: DisplayList, before: MotionDoc, after: MotionDoc, measure: TextMeasure): DisplayList | null {
  const pair = onlyClip(before, after);
  const edit = pair && EDIT_OF.find(([, is]) => is(pair[0], pair[1]))?.[0];
  return pair && edit ? PATCHES[edit](list, before, after, pair[0], pair[1], measure) : null;
}
