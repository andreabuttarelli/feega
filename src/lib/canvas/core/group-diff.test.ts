import { describe, expect, it } from 'vitest';
import type { DisplayList, Item } from '$lib/motion/gpu-full/display-list';
import { spliceOf } from './group-diff';

const bar = (n: number, red = 1) => ({ kind: 'path', clip: `bar${n}`, contours: [[n, 0, n + 5, 0, n + 5, 5]], paint: { kind: 'solid', color: [red, 0, 0, 1] } }) as unknown as Item;
const listOf = (items: Item[], extra: Partial<DisplayList> = {}) => ({ width: 100, height: 50, background: null, items, ...extra }) as unknown as DisplayList;
const many = (n: number) => Array.from({ length: n }, (_, i) => bar(i));

describe('group splice', () => {
  it('sends only the item that changed', () => {
    const before = many(40);
    const after = [...before];
    after[35] = bar(35, 0.5);

    const splice = spliceOf(listOf(before), listOf(after));

    expect(splice).toEqual({ head: 35, tail: 4, items: [after[35]] });
  });

  it('sends an added item and nothing else', () => {
    const before = many(10);

    expect(spliceOf(listOf(before), listOf([...before, bar(10)]))).toEqual({ head: 10, tail: 0, items: [bar(10)] });
  });

  it('sends a removed item as a gap', () => {
    const before = many(10);
    const after = before.filter((_, i) => i !== 3);

    expect(spliceOf(listOf(before), listOf(after))).toEqual({ head: 3, tail: 6, items: [] });
  });

  it('sends nothing when the lists are the same', () => {
    const before = many(10);

    expect(spliceOf(listOf(before), listOf(many(10)))).toEqual({ head: 10, tail: 0, items: [] });
  });

  it('never counts an item twice when head and tail meet', () => {
    const same = bar(0);
    const splice = spliceOf(listOf([same, same, same]), listOf([same, same]));

    expect(splice!.head + splice!.tail).toBeLessThanOrEqual(2);
  });

  it('gives up when nothing is shared, so the caller puts the whole group', () => {
    expect(spliceOf(listOf(many(10)), listOf(many(10).map((_, i) => bar(i, 0.2))))).toBeNull();
  });

  it('gives up when the frame itself changed', () => {
    const items = many(10);

    expect(spliceOf(listOf(items), listOf(items, { width: 200 }))).toBeNull();
    expect(spliceOf(listOf(items), listOf(items, { background: [0, 0, 0, 1] as never }))).toBeNull();
  });

  it('reads each list once however many times it is compared', () => {
    const before = listOf(many(10));
    const after = listOf([...many(9), bar(9, 0.5)]);
    const reads = { count: 0 };
    const original = JSON.stringify;
    JSON.stringify = ((...args: Parameters<typeof JSON.stringify>) => ((reads.count += 1), original(...args))) as typeof JSON.stringify;

    try {
      spliceOf(before, after);
      const first = reads.count;
      spliceOf(before, after);
      expect(reads.count).toBe(first);
    } finally {
      JSON.stringify = original;
    }
  });
});
