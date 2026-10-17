import { describe, expect, it } from 'vitest';
import { LOD_EXIT_ZOOM, LOD_ZOOM, lodNext, lodWanted, mediaPoster, oncePerUrl, posterRects, PosterSource, THUMB_WIDTH } from './poster-lod';

const screen = { width: 1000, height: 800 };
const node = (id: string, x: number, y: number) => ({ id, x, y, w: 400, h: 300 });

describe('lodNext', () => {
  it('enters below the threshold and leaves only past the exit band', () => {
    expect(lodNext(false, LOD_ZOOM * 0.99)).toBe(true);
    expect(lodNext(true, LOD_ZOOM)).toBe(true);
    expect(lodNext(true, LOD_EXIT_ZOOM)).toBe(false);
    expect(lodNext(false, LOD_ZOOM)).toBe(false);
  });
});

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

describe('oncePerUrl', () => {
  it('loads a url once however many nodes show it, and never more than the limit at a time', async () => {
    let running = 0;
    let peak = 0;
    const calls: string[] = [];
    const load = oncePerUrl(async (url: string) => {
      calls.push(url);
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return url.toUpperCase();
    }, 2);

    const out = await Promise.all(['a', 'b', 'a', 'c', 'd', 'b'].map(load));

    expect(out).toEqual(['A', 'B', 'A', 'C', 'D', 'B']);
    expect(calls).toEqual(['a', 'b', 'c', 'd']);
    expect(peak).toBe(2);
  });
});

describe('mediaPoster', () => {
  const url = '/p/pr/c/cv/assets/a1';

  it('draws an image node from its smallest tier', () => {
    expect(mediaPoster('image', url)).toEqual({ url: '/p/pr/c/cv/assets/a1?size=256', source: PosterSource.Image });
  });

  it('draws a video node from a paused frame of the file itself', () => {
    expect(mediaPoster('video', url)).toEqual({ url, source: PosterSource.VideoFrame });
  });

  it('leaves other nodes, and media without a file, in the DOM', () => {
    expect(mediaPoster('text', url)).toBeNull();
    expect(mediaPoster('image', null)).toBeNull();
  });
});
