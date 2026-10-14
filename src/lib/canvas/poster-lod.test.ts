import { describe, expect, it } from 'vitest';
import { LOD_ZOOM, lodWanted, posterRects, THUMB_WIDTH } from './poster-lod';

const screen = { width: 1000, height: 800 };
const node = (id: string, x: number, y: number) => ({ id, x, y, w: 400, h: 300 });

describe('posterRects', () => {
  it('wants posters only below the readable threshold', () => {
    expect(lodWanted(LOD_ZOOM)).toBe(false);
    expect(lodWanted(LOD_ZOOM / 2)).toBe(true);
  });

  it('projects each poster node to screen pixels below the threshold', () => {
    const rects = posterRects([node('a', 100, 200)], { x: 10, y: 20, zoom: 0.1 }, screen, new Set(['a']));

    expect(rects).toEqual([{ id: 'a', x: 20, y: 40, w: 40, h: 30 }]);
  });

  it('skips nodes off screen and nodes without a poster', () => {
    const rects = posterRects([node('far', 100_000, 0), node('bare', 0, 0)], { x: 0, y: 0, zoom: 0.1 }, screen, new Set(['far']));

    expect(rects).toEqual([]);
  });
});

it('keeps thumbnails small enough that 500 of them fit a phone budget', () => {
  expect(THUMB_WIDTH * THUMB_WIDTH * 4 * 500).toBeLessThan(64 * 1024 * 1024);
});
