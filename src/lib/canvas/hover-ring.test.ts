import { describe, expect, it } from 'vitest';
import { hoverRingStyle } from './hover-ring';

const BOX = { x: 100, y: 200, w: 300, h: 150 };

const parsed = (style: string) => Object.fromEntries(style.split(';').map((d) => d.split(':'))) as Record<string, string>;

const px = (v: string) => Number.parseFloat(v);

const ringAt = (zoom: number, over: { rotation?: number; radius?: number } = {}) => parsed(hoverRingStyle({ x: 40, y: 30, zoom }, { ...BOX, ...over }));

describe('hover ring', () => {
  it('stays the same distance outside the node at every zoom', () => {
    [0.5, 1, 2, 4].forEach((zoom) => {
      const r = ringAt(zoom);
      const gap = 40 + BOX.x * zoom - px(r.left);

      expect(gap).toBeCloseTo(2.5, 5);
      expect(px(r.width)).toBeCloseTo(BOX.w * zoom + 2 * gap, 5);
      expect(px(r.height)).toBeCloseTo(BOX.h * zoom + 2 * gap, 5);
    });
  });

  it('keeps a 1.5px line at every zoom', () => {
    [1, 2, 4].forEach((zoom) => expect(px(ringAt(zoom)['border-width'])).toBeCloseTo(1.5, 5));
  });

  it('thickens the line on a far view like the selection ring does', () => {
    expect(px(ringAt(0.05)['border-width'])).toBeGreaterThan(px(ringAt(1)['border-width']));
  });

  it('rounds the corners with the node radius scaled by the zoom', () => {
    const r = ringAt(2, { radius: 8 });

    expect(px(r['border-radius'])).toBeCloseTo(8 * 2 + 2.5, 5);
  });

  it('turns with the node', () => {
    expect(ringAt(1, { rotation: 30 }).rotate).toBe('30deg');
    expect(ringAt(1).rotate).toBeUndefined();
  });
});
