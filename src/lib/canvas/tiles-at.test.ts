import { describe, expect, it } from 'vitest';
import { tilesAt } from './tiles-at';

describe('the tiles under the pointer', () => {
  it('lists the topmost first and skips the ones the point misses', () => {
    const tiles = [
      { id: 'back', x: 0, y: 0, w: 500, h: 500 },
      { id: 'away', x: 900, y: 900, w: 10, h: 10 },
      { id: 'front', x: 50, y: 50, w: 100, h: 100 }
    ];
    expect(tilesAt(tiles, { x: 60, y: 60 })).toEqual(['front', 'back']);
  });
});
