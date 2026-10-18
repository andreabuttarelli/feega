import { describe, expect, it } from 'vitest';
import { Edge } from '$lib/motion/space';
import { alignTiles } from './align';

const tiles = [
  { id: 'a', x: 0, y: 0, width: 100, height: 50 },
  { id: 'b', x: 200, y: 100, width: 50, height: 100 }
];

describe('aligning canvas tiles', () => {
  it('moves every tile to the shared edge of the selection', () => {
    expect(alignTiles(tiles, Edge.Left)).toEqual([{ id: 'b', x: 0, y: 100 }]);
    expect(alignTiles(tiles, Edge.Right)).toEqual([{ id: 'a', x: 150, y: 0 }]);
    expect(alignTiles(tiles, Edge.Bottom)).toEqual([{ id: 'a', x: 0, y: 150 }]);
  });

  it('centres on the middle of the selection bounds', () => {
    expect(alignTiles(tiles, Edge.Center)).toEqual([
      { id: 'a', x: 75, y: 0 },
      { id: 'b', x: 100, y: 100 }
    ]);
    expect(alignTiles(tiles, Edge.Middle)).toEqual([
      { id: 'a', x: 0, y: 75 },
      { id: 'b', x: 200, y: 50 }
    ]);
  });

  it('a single tile has nothing to align to', () => {
    expect(alignTiles([tiles[0]], Edge.Left)).toEqual([]);
  });
});
