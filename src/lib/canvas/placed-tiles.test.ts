import { describe, expect, it } from 'vitest';
import { placedTiles } from './placed-tiles';

const tile = (id: string, x: number) => ({ id, kind: 'text', x, y: 0, w: 100, h: 50 });

const tiles = [tile('a', 0), tile('b', 200), tile('c', 400)];
const NONE = new Map();

describe('placed tiles during a gesture', () => {
  it('a tile no gesture touches keeps the same object from one pointer move to the next', () => {
    const first = placedTiles(tiles, { overrides: new Map([['a', { x: 10, y: 0, w: 100, h: 50 }]]), turning: NONE, images: NONE }, new Map());
    const second = placedTiles(tiles, { overrides: new Map([['a', { x: 20, y: 0, w: 100, h: 50 }]]), turning: NONE, images: NONE }, first.memo);

    expect(second.tiles[1]).toBe(first.tiles[1]);
    expect(second.tiles[2]).toBe(first.tiles[2]);
    expect(second.tiles[0]).not.toBe(first.tiles[0]);
    expect(second.tiles[0]).toMatchObject({ id: 'a', x: 20 });
  });

  it('the moved tile is drawn at its override box, and turning sets its rotation', () => {
    const { tiles: placed } = placedTiles(tiles, { overrides: new Map([['b', { x: 5, y: 6, w: 70, h: 80 }]]), turning: new Map([['c', 30]]), images: NONE }, new Map());

    expect(placed[1]).toMatchObject({ id: 'b', x: 5, y: 6, w: 70, h: 80 });
    expect(placed[2]).toMatchObject({ id: 'c', x: 400, rotation: 30 });
  });

  it('a tile whose source row changes is placed again', () => {
    const first = placedTiles(tiles, { overrides: NONE, turning: NONE, images: NONE }, new Map());
    const moved = [tiles[0], tile('b', 250), tiles[2]];
    const second = placedTiles(moved, { overrides: NONE, turning: NONE, images: NONE }, first.memo);

    expect(second.tiles[1]).toMatchObject({ x: 250 });
    expect(second.tiles[0]).toBe(first.tiles[0]);
  });
});
