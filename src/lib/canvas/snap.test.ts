import { describe, expect, it } from 'vitest';
import { snapBox, snapDrag } from './snap';

const box = (x: number, y: number, w = 100, h = 100) => ({ x, y, w, h });

describe('smart guides while dragging tiles', () => {
  it('snaps a near edge onto another tile edge and draws the guide across both', () => {
    const snap = snapBox(box(203, 300), [box(100, 0)], 8);
    expect(snap.dx).toBe(-3);
    expect(snap.dy).toBe(0);
    expect(snap.guides).toContainEqual({ axis: 'x', at: 200, from: 0, to: 400 });
  });

  it('snaps centres too', () => {
    const snap = snapBox(box(0, 296), [box(400, 300, 100, 100)], 8);
    expect(snap.dy).toBe(4);
    expect(snap.guides.some((g) => g.axis === 'y')).toBe(true);
  });

  it('takes the closest line when several are in reach', () => {
    expect(snapBox(box(105, 500), [box(0, 0), box(102, 900)], 8).dx).toBe(-3);
  });

  it('leaves the tile alone when nothing is within reach', () => {
    expect(snapBox(box(150, 500), [box(0, 0)], 8)).toEqual({ dx: 0, dy: 0, guides: [] });
  });
});

describe('a dragged selection snaps as one box', () => {
  it('moves every dragged tile by the snap of their joint box', () => {
    const dragged = [{ id: 'a', x: 203, y: 300, w: 50, h: 50 }, { id: 'b', x: 253, y: 300, w: 50, h: 50 }];
    const snap = snapDrag(dragged, [box(100, 0)], 8);
    expect(snap.moves).toEqual([{ id: 'a', x: 200, y: 300 }, { id: 'b', x: 250, y: 300 }]);
  });
});
