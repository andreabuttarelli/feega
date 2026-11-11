import { describe, expect, it } from 'vitest';
import { cacheKey, evictions, premultiply, stepOf, tileIdentity, tilesToRestore, tileWorld, unpremultiply, type TileLayer, type TileLook } from './tile-cache';

const LOOK: TileLook = { canvasId: 'c1', paper: '#ffffff', line: '#e5e5e5', resolution: 2 };
const frame = (id: string, revision: number, x = 0): TileLayer => ({ id, content: `${id}:${revision}`, box: { x, y: 0, w: 100, h: 100 } });
const KEY = { step: 0, tx: 0, ty: 0 };

describe('tile identity', () => {
  it('an edited frame never finds the tile cached for its old revision', () => {
    const before = cacheKey(LOOK, KEY, tileIdentity(KEY, [frame('a', 1)])!);
    const after = cacheKey(LOOK, KEY, tileIdentity(KEY, [frame('a', 2)])!);

    expect(after).not.toBe(before);
  });

  it('an edit to a frame elsewhere keeps the tile', () => {
    const before = tileIdentity(KEY, [frame('a', 1), frame('far', 1, 5000)]);
    const after = tileIdentity(KEY, [frame('a', 1), frame('far', 9, 5000)]);

    expect(after).toBe(before);
  });

  it('a frame being edited makes the tile uncacheable', () => {
    expect(tileIdentity(KEY, [{ ...frame('a', 1), content: null }])).toBeNull();
  });

  it('theme, pixel ratio and canvas are part of the key', () => {
    const identity = tileIdentity(KEY, [frame('a', 1)])!;
    const keys = new Set([cacheKey(LOOK, KEY, identity), cacheKey({ ...LOOK, paper: '#111111' }, KEY, identity), cacheKey({ ...LOOK, resolution: 1 }, KEY, identity), cacheKey({ ...LOOK, canvasId: 'c2' }, KEY, identity)]);

    expect(keys.size).toBe(4);
  });

  it('a tile over empty canvas is not worth caching', () => {
    expect(tileIdentity(KEY, [frame('far', 1, 5000)])).toBeNull();
  });

  it('a moved frame changes the tile', () => {
    expect(tileIdentity(KEY, [frame('a', 1, 10)])).not.toBe(tileIdentity(KEY, [frame('a', 1)]));
  });
});

describe('tile geometry', () => {
  it('matches the engine steps: a quarter octave, rounded up', () => {
    expect(stepOf(1)).toBe(0);
    expect(stepOf(1.1)).toBe(1);
    expect(tileWorld({ step: 4, tx: 1, ty: 0 })).toEqual({ x: 128, y: 0, w: 128, h: 128 });
  });

  it('restores the view step first, then the coarse ones', () => {
    const keys = tilesToRestore({ x: 0, y: 0, zoom: 1 }, { width: 512, height: 256 });

    expect(keys.slice(0, 2)).toEqual([
      { step: 0, tx: 0, ty: 0 },
      { step: 0, tx: 1, ty: 0 }
    ]);
    expect(new Set(keys.map((k) => k.step))).toEqual(new Set([0, -4, -12, -16]));
  });
});

describe('disk budget', () => {
  it('drops the least recently used entries until the cap holds', () => {
    const entries = [
      { key: 'old', bytes: 40, used: 1 },
      { key: 'new', bytes: 40, used: 3 },
      { key: 'mid', bytes: 40, used: 2 }
    ];

    expect(evictions(entries, 90)).toEqual(['old']);
    expect(evictions(entries, 120)).toEqual([]);
  });
});

describe('pixels', () => {
  it('survive the trip through straight alpha', () => {
    const pixels = new Uint8Array([100, 50, 0, 128, 255, 255, 255, 255, 0, 0, 0, 0]);

    expect([...premultiply(unpremultiply(pixels.slice()))]).toEqual([...pixels]);
  });
});
