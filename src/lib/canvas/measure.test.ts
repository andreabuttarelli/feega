import { describe, expect, it } from 'vitest';
import { tileGaps } from './measure';

const tile = (id: string, x: number, y: number, w = 100, h = 100) => ({ id, x, y, w, h });

describe('⌥ on the canvas measures from the selection to the hovered tile', () => {
  it('measures from the box around the whole selection', () => {
    expect(tileGaps([tile('a', 0, 0), tile('b', 0, 200)], tile('c', 300, 0))).toEqual([{ axis: 'x', from: 100, to: 300, at: 50 }]);
  });

  it('nothing when the hovered tile is part of the selection or nothing is selected', () => {
    expect(tileGaps([tile('a', 0, 0)], tile('a', 0, 0))).toEqual([]);
    expect(tileGaps([], tile('c', 300, 0))).toEqual([]);
  });
});
