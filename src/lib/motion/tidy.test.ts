import { describe, expect, it } from 'vitest';
import { tidyMoves } from './tidy';

const box = (id: string, left: number, top: number, width = 100, height = 100) => ({ id, left, top, width, height });

const placed = (rects: ReturnType<typeof box>[]) => {
  const moves = new Map(tidyMoves(rects).map((m) => [m.id, m]));
  return Object.fromEntries(rects.map((r) => [r.id, [r.left + (moves.get(r.id)?.dx ?? 0), r.top + (moves.get(r.id)?.dy ?? 0)]]));
};

describe('tidy up', () => {
  it('a row keeps its first layer and spaces the rest by the most common gap, not touching the other axis', () => {
    expect(placed([box('a', 0, 0), box('b', 120, 10), box('c', 240, 5), box('d', 400, 0)])).toEqual({ a: [0, 0], b: [120, 10], c: [240, 5], d: [360, 0] });
  });

  it('a column does the same vertically', () => {
    expect(placed([box('a', 0, 0), box('b', 5, 150), box('c', 0, 260)])).toEqual({ a: [0, 0], b: [5, 110], c: [0, 220] });
  });

  it('a grid is laid out from the top-left corner on both axes', () => {
    expect(placed([box('a', 0, 0), box('b', 130, 8), box('c', 3, 130), box('d', 133, 138)])).toEqual({ a: [0, 0], b: [130, 0], c: [0, 130], d: [130, 130] });
  });

  it('one layer is already tidy', () => {
    expect(tidyMoves([box('a', 5, 5)])).toEqual([]);
  });
});
