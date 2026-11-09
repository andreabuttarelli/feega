import { describe, expect, it } from 'vitest';
import { ItemKind } from '@feega/motion-core/motion/gpu-full/display-list';
import { thumbClip, thumbList, thumbRect } from './frame-thumbs';

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
});
