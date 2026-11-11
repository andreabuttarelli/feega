import { describe, expect, it } from 'vitest';
import type { DisplayList, Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { liftOut, liftedPut } from './lifted-drag';

const bar = (clip: string) => ({ kind: 'path', clip, contours: [[0, 0, 5, 0, 5, 5]] }) as unknown as Item;
const group = (clip: string, items: Item[]) => ({ kind: 'group', clip, items }) as unknown as Item;
const listOf = (items: Item[]) => ({ width: 100, height: 50, background: null, items, unsupported: [] }) as unknown as DisplayList;

describe('lifting a dragged element out of its frame', () => {
  it('splits the dragged items from the rest, as a gap the core can patch', () => {
    const items = [bar('a'), bar('b'), bar('b-child'), bar('c')];

    const lifted = liftOut(listOf(items), new Set(['b', 'b-child']))!;

    expect(lifted.splice).toEqual({ head: 1, tail: 1, items: [] });
    expect(lifted.rest.items).toEqual([items[0], items[3]]);
    expect(lifted.moving.items).toEqual([items[1], items[2]]);
    expect(lifted.moving.width).toBe(100);
  });

  it('refuses when the dragged items are not drawn together', () => {
    expect(liftOut(listOf([bar('b'), bar('a'), bar('b')]), new Set(['b']))).toBeNull();
  });

  it('refuses when the dragged element sits inside a group it does not own', () => {
    expect(liftOut(listOf([group('mask', [bar('b')]), bar('a')]), new Set(['b']))).toBeNull();
  });

  it('refuses when nothing dragged is drawn', () => {
    expect(liftOut(listOf([bar('a')]), new Set(['b']))).toBeNull();
  });

  it('places the moving layer by the drag offset, in frame pixels', () => {
    const frame = { id: 'f', group: 'g', box: { x: 10, y: 20, w: 50, h: 25 }, size: { width: 100, height: 50 }, bytes: 0 };

    const put = liftedPut(frame, 'g:moving', [40, -10]);

    expect(put).toEqual({ id: 'f:moving', group: 'g:moving', box: { x: 30, y: 15, w: 50, h: 25 }, size: { width: 100, height: 50 }, bytes: 0 });
  });
});
