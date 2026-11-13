import { describe, expect, it } from 'vitest';
import { ItemKind } from '@feega/motion-core/motion/gpu-full/display-list';
import { posterSize, shotSize, thumbClip, thumbList, thumbRect, thumbsDue } from './frame-thumbs';

const BOX = { x: 100, y: 50, w: 200, h: 400 };

describe('frame thumbnails', () => {
  it('a stored thumbnail stands in as one picture filling the whole frame', () => {
    const list = thumbList('f1:3', { width: 200, height: 400 });
    expect([list.width, list.height]).toEqual([200, 400]);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ kind: ItemKind.Image, clip: thumbClip('f1:3'), size: { width: 200, height: 400 }, fit: 'fill' });
  });

  it('captures a frame only when all of it is on screen, in canvas pixels', () => {
    const view = { x: 10, y: 20, zoom: 0.5 };
    expect(thumbRect(BOX, view, { width: 800, height: 600 }, 2)).toEqual({ x: 120, y: 90, width: 200, height: 400 });
    expect(thumbRect(BOX, { ...view, x: -60 }, { width: 800, height: 600 }, 2)).toBeNull();
  });

  it('skips a frame too small on screen to make a useful stand-in', () => {
    expect(thumbRect(BOX, { x: 0, y: 0, zoom: 0.01 }, { width: 800, height: 600 }, 1)).toBeNull();
  });

  it('takes every finished frame in the last paint, so views drawn last still leave a thumbnail', () => {
    const frames = [{ id: 'a', key: 'a:1', group: 'a:1' }, { id: 'b@bp:tablet', key: 'b@bp:tablet:1', group: 'b@bp:tablet:live1' }, { id: 'c', key: 'c:1', group: 'c:1' }];
    const shown = [{ id: 'a', group: 'a:1' }, { id: 'b@bp:tablet', group: 'b@bp:tablet:live1' }, { id: 'c', group: 'c:1:thumb' }];
    expect(thumbsDue(shown, frames, new Set()).map((f) => f.id)).toEqual(['a', 'b@bp:tablet']);
    expect(thumbsDue(shown, frames, new Set(['a:1'])).map((f) => f.id)).toEqual(['b@bp:tablet']);
  });
});

describe('posterSize', () => {
  it('una pagina alta resta intera, larga 480 px', () => {
    expect(posterSize({ x: 0, y: 0, w: 1280, h: 4800 })).toEqual({ width: 480, height: 1800, scale: 0.375 });
  });

  it('una pagina altissima si ferma al lato massimo', () => {
    const size = posterSize({ x: 0, y: 0, w: 1280, h: 20000 });
    expect(size.height).toBe(4096);
    expect(size.width).toBe(262);
  });

  it('un frame piccolo non si ingrandisce', () => {
    expect(posterSize({ x: 0, y: 0, w: 200, h: 100 })).toEqual({ width: 200, height: 100, scale: 1 });
  });
});

describe('shotSize', () => {
  it('a phone snapshot is as wide as a readable frame in device pixels, and no taller than a texture a phone keeps cheaply', () => {
    expect(shotSize({ x: 0, y: 0, w: 1280, h: 2560 }, 320)).toEqual({ width: 320, height: 640, scale: 0.25 });
    expect(shotSize({ x: 0, y: 0, w: 1280, h: 15354 }, 320)).toEqual({ width: 171, height: 2048, scale: 2048 / 15354 });
  });
});
