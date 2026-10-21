import type { DisplayList, Item } from '$lib/motion/gpu-full/display-list';

export type Splice = { head: number; tail: number; items: Item[] };

type Hashed = { frame: string; items: string[] };

const hashed = new WeakMap<DisplayList, Hashed>();

function hashOf(list: DisplayList): Hashed {
  const known = hashed.get(list);
  if (known) {
    return known;
  }
  const made = { frame: JSON.stringify([list.width, list.height, list.background, list.faces]), items: list.items.map((i) => JSON.stringify(i)) };
  hashed.set(list, made);
  return made;
}

export function spliceOf(before: DisplayList, after: DisplayList): Splice | null {
  const [old, next] = [hashOf(before), hashOf(after)];
  if (old.frame !== next.frame) {
    return null;
  }
  const shared = Math.min(old.items.length, next.items.length);
  let head = 0;
  while (head < shared && old.items[head] === next.items[head]) {
    head++;
  }
  let tail = 0;
  while (tail < shared - head && old.items[old.items.length - 1 - tail] === next.items[next.items.length - 1 - tail]) {
    tail++;
  }
  if (head + tail === 0 && next.items.length > 0) {
    return null;
  }
  return { head, tail, items: after.items.slice(head, next.items.length - tail) };
}
