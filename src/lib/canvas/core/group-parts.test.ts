import { describe, expect, it } from 'vitest';
import type { DisplayList, Item } from '$lib/motion/gpu-full/display-list';
import { parts } from './group-parts';

const list = (n: number) => ({ width: 10, height: 20, background: null, items: Array.from({ length: n }, (_, i) => ({ clip: `c${i}` }) as unknown as Item) }) as DisplayList;

describe('group parts', () => {
  it('splits a big group into parts that keep its size and background and all its items in order', () => {
    const split = parts(list(5), 2);

    expect(split.map((p) => p.items.map((i) => i.clip))).toEqual([['c0', 'c1'], ['c2', 'c3'], ['c4']]);
    expect(split.every((p) => p.width === 10 && p.height === 20)).toBe(true);
  });

  it('an empty group is still one part', () => {
    expect(parts(list(0), 2)).toHaveLength(1);
  });
});
