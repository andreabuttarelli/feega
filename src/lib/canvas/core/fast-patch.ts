import { ItemKind, type DisplayList, type GroupItem, type Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { clipsOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { ParentOpacity, ancestorsOf } from '@feega/motion-core/motion/parent';

enum Reach {
  Self = 'self',
  Subtree = 'subtree'
}

type Change = { clip: MotionClip; reach: Reach; patch: (items: Item[], owned: ReadonlySet<string>) => Item[] | null };

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

const PLACED_ONLY = new Set(['x', 'y', 'opacity']);

const sharesScreenSpace = (item: Item) => !item.scissor && !item.masks && !item.matte && !('within' in item && item.within);

function shifted(items: Item[], owned: ReadonlySet<string>, by: [number, number]): Item[] | null {
  const out: Item[] = [];
  for (const item of items) {
    if (!owned.has(item.clip)) {
      const inner = item.kind === ItemKind.Group ? shifted(item.items, owned, by) : null;
      if (item.kind === ItemKind.Group && !inner) {
        return null;
      }
      out.push(inner && item.kind === ItemKind.Group ? { ...item, items: inner } : item);
      continue;
    }
    if (!sharesScreenSpace(item)) {
      return null;
    }
    const [a, b, c, d, e, f] = item.matrix;
    out.push({ ...item, matrix: [a, b, c, d, e + by[0], f + by[1]] });
  }
  return out;
}

function hiddenOut(items: Item[], owned: ReadonlySet<string>): Item[] {
  return items.filter((i) => !owned.has(i.clip)).map((i) => (i.kind === ItemKind.Group ? { ...i, items: hiddenOut(i.items, owned) } : i));
}

function fadeOf(a: MotionClip, b: MotionClip): Change | null {
  const was = Number(a.transform.opacity ?? OPAQUE);
  const now = Number(b.transform.opacity ?? OPAQUE);
  if (changedKeys(a.transform, b.transform).join() !== 'opacity' || !(was > 0) || a.keyframes.opacity) {
    return null;
  }
  return { clip: b, reach: Reach.Subtree, patch: (items, owned) => faded(items, owned, now / was) };
}

function hideOf(doc: MotionDoc, a: MotionClip, b: MotionClip): Change | null {
  const reflows = ancestorsOf(doc, b.id).some((id) => clipsOf(doc).find((c) => c.id === id)?.autoLayout);
  return !a.hidden && b.hidden && !reflows ? { clip: b, reach: Reach.Self, patch: hiddenOut } : null;
}

const still = (doc: MotionDoc, id: string) => {
  const clip = clipsOf(doc).find((c) => c.id === id);
  return !!clip && !clip.autoLayout && !Object.keys(clip.keyframes).length && Object.keys(clip.transform).every((k) => PLACED_ONLY.has(k));
};

function moveOf(doc: MotionDoc, a: MotionClip, b: MotionClip): Change | null {
  const keys = changedKeys(a.transform, b.transform);
  if (!keys.length || keys.some((k) => k !== 'x' && k !== 'y') || a.keyframes.x || a.keyframes.y || !ancestorsOf(doc, b.id).every((id) => still(doc, id))) {
    return null;
  }
  const by: [number, number] = [(Number(b.transform.x ?? 0) - Number(a.transform.x ?? 0)) * doc.width, (Number(b.transform.y ?? 0) - Number(a.transform.y ?? 0)) * doc.height];
  return { clip: b, reach: Reach.Subtree, patch: (items, owned) => shifted(items, owned, by) };
}

function onlyChange(before: MotionDoc, after: MotionDoc): Change | null {
  if (changedKeys(before, after).some((k) => k !== 'tracks')) {
    return null;
  }
  const [was, now] = [clipsOf(before), clipsOf(after)];
  if (was.length !== now.length || was.some((c, i) => c.id !== now[i].id)) {
    return null;
  }
  const moved = now.flatMap((c, i) => (c === was[i] ? [] : [i]));
  if (moved.length !== 1) {
    return null;
  }
  const [a, b] = [was[moved[0]], now[moved[0]]];
  const keys = changedKeys(a, b).join();
  if (keys === 'hidden') {
    return hideOf(after, a, b);
  }
  return keys === 'transform' ? (fadeOf(a, b) ?? moveOf(after, a, b)) : null;
}

function ownedBy(doc: MotionDoc, { clip, reach }: Change): Set<string> | null {
  const id = clip.id;
  if (reach === Reach.Self) {
    return new Set([id]);
  }
  const below = clipsOf(doc).filter((c) => ancestorsOf(doc, c.id).includes(id));
  return below.every((c) => c.parentOpacity === ParentOpacity.Inherit) ? new Set([id, ...below.map((c) => c.id)]) : null;
}

export function fastPatch(list: DisplayList, before: MotionDoc, after: MotionDoc): DisplayList | null {
  const change = onlyChange(before, after);
  const owned = change && ownedBy(after, change);
  const items = change && owned ? change.patch(list.items, owned) : null;
  return items ? { ...list, items } : null;
}
