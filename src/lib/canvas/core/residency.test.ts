import { describe, expect, it } from 'vitest';
import { CACHE_SHARE, cached, resident, heldWhileEdited, uncached } from './residency';

const view = { x: 0, y: 0, zoom: 1 };
const screen = { width: 1000, height: 1000 };
const frame = (id: string, x: number, images: number, imageEdge = 100) => ({ id, group: `${id}:1`, box: { x, y: 0, w: 100, h: 100 }, size: { width: 100, height: 100 }, bytes: images * imageEdge * imageEdge * 4 });

describe('frame residency', () => {
  it('vector frames stay resident wherever they are', () => {
    expect(resident([frame('v', 9000, 0)], view, screen, 0).map((f) => f.id)).toEqual(['v']);
  });

  it('media frames are resident only on screen', () => {
    expect(resident([frame('on', 0, 1), frame('off', 9000, 1)], view, screen, 1e9).map((f) => f.id)).toEqual(['on']);
  });

  it('counts the bytes of its pictures, not its whole doc once per picture', () => {
    const tall = { ...frame('landing', 0, 0), size: { width: 1440, height: 5000 }, bytes: 2 * 400 * 300 * 4 };
    expect(resident([tall], view, screen, 1_000_000).map((f) => f.id)).toEqual(['landing']);
  });

  it('over budget, media frames beyond it are left out', () => {
    const bytes = 100 * 100 * 4;
    expect(resident([frame('a', 0, 1), frame('b', 200, 1)], view, screen, bytes).length).toBe(1);
  });

  it('caches frames whose texture at the current zoom fits the cache share of the budget', () => {
    const texture = 200 * 200 * 4;
    const frames = [frame('media', 0, 1), frame('a', 200, 0), frame('b', 400, 0)];

    expect(cached(frames, { x: 0, y: 0, zoom: 2 }, screen, texture / CACHE_SHARE).map((f) => f.cache)).toEqual([true, false, false]);
    expect(cached(frames, { x: 0, y: 0, zoom: 2 }, screen, (3 * texture) / CACHE_SHARE).every((f) => f.cache)).toBe(true);
  });
});

describe('a view at rest', () => {
  it('draws every frame from its vectors, never from a cache texture, so it is crisp at the current zoom', () => {
    const shown = cached([frame('a', 0, 0), frame('b', 200, 0)], view, screen, 1e9);

    expect(shown.every((f) => f.cache)).toBe(true);
    expect(uncached(shown).every((f) => !f.cache)).toBe(true);
  });
});

describe('a node under a live edit', () => {
  it('holds its texture so each step only stretches its use, never re-rasters', () => {
    const shown = cached([frame('a', 0, 0), frame('b', 200, 0)], view, screen, 1e9);
    expect(heldWhileEdited(shown, new Set(['a'])).map((f) => [f.id, f.cache, f.hold])).toEqual([
      ['a', true, true],
      ['b', true, undefined]
    ]);
  });

  it('is cached even past the texture budget, so a heavy frame is not redrawn item by item each step', () => {
    const shown = cached([frame('a', 0, 1, 2000)], view, screen, 0);
    expect(heldWhileEdited(shown, new Set(['a']))[0]).toMatchObject({ cache: true, hold: true });
  });
});
