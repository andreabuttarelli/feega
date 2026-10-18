import { describe, expect, it } from 'vitest';
import { Corner, clickBox, closesOnFirst, cornerAt, cornerInset, dragRect, nudge, resizeFromCorner, roundnessFromInset } from './draw-tool';

describe('dragging a box to create an element inside a frame', () => {
  it('centers the box between the two drag points', () => {
    expect(dragRect({ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.4 }, false)).toEqual({ x: 0.4, y: 0.3, width: 0.4, height: 0.2 });
  });

  it('works dragging up and to the left too', () => {
    expect(dragRect({ x: 0.6, y: 0.6 }, { x: 0.2, y: 0.4 }, false)).toEqual({ x: 0.4, y: 0.5, width: 0.4, height: 0.2 });
  });

  it('shift locks the box to a square, growing the smaller side to match', () => {
    const box = dragRect({ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.3 }, true)!;
    expect(box.width).toBe(0.4);
    expect(box.height).toBe(0.4);
  });

  it('refuses a drag that never leaves a visible box', () => {
    expect(dragRect({ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 }, false)).toBeNull();
  });
});

describe('resizing a box from a corner handle', () => {
  const box = { x: 0.5, y: 0.5, width: 0.2, height: 0.2 };

  it('keeps the opposite corner in place', () => {
    const resized = resizeFromCorner(box, Corner.SE, { x: 0.8, y: 0.8 }, false)!;
    expect(resized).toEqual({ x: 0.6, y: 0.6, width: 0.4, height: 0.4 });
    expect(resized.x - resized.width / 2).toBeCloseTo(0.4, 5);
    expect(resized.y - resized.height / 2).toBeCloseTo(0.4, 5);
  });

  it('shift keeps the box square even when dragged off-axis', () => {
    const resized = resizeFromCorner(box, Corner.SE, { x: 0.9, y: 0.7 }, true)!;
    expect(resized.width).toBe(resized.height);
  });

  it('a different corner anchors the opposite side', () => {
    const resized = resizeFromCorner(box, Corner.NW, { x: 0.2, y: 0.2 }, false)!;
    expect(resized.x + resized.width / 2).toBeCloseTo(0.6, 5);
    expect(resized.y + resized.height / 2).toBeCloseTo(0.6, 5);
  });
});

describe('corner radius from an on-canvas inset drag', () => {
  it('no inset means a sharp corner', () => {
    expect(roundnessFromInset({ width: 0.4, height: 0.2 }, 0)).toBe(0);
  });

  it('an inset of half the short side is fully rounded', () => {
    expect(roundnessFromInset({ width: 0.4, height: 0.2 }, 0.1)).toBe(0.5);
  });

  it('clamps a negative inset to sharp and an overshoot to fully rounded', () => {
    expect(roundnessFromInset({ width: 0.4, height: 0.2 }, -1)).toBe(0);
    expect(roundnessFromInset({ width: 0.4, height: 0.2 }, 10)).toBe(0.5);
  });

  it('is relative to the shorter side, not the longer one', () => {
    expect(roundnessFromInset({ width: 0.4, height: 0.2 }, 0.05)).toBeCloseTo(0.25, 5);
  });
});

describe('nudging a selection with the arrow keys', () => {
  it('moves the box without changing its size', () => {
    expect(nudge({ x: 0.5, y: 0.5, width: 0.1, height: 0.1 }, 0.01, -0.01)).toEqual({ x: 0.51, y: 0.49, width: 0.1, height: 0.1 });
  });
});

describe('closing a pen path on its first point', () => {
  const corner = (x: number, y: number) => ({ p: [x, y] as const, in: [x, y] as const, out: [x, y] as const });
  const open = [{ closed: false, vertices: [corner(10, 10), corner(100, 10), corner(100, 80)] }];

  it('a click within reach of the first point closes an open path of three or more points', () => {
    expect(closesOnFirst(open, [12, 9], 6)).toBe(true);
    expect(closesOnFirst(open, [30, 30], 6)).toBe(false);
  });

  it('two points or an already closed path never close', () => {
    expect(closesOnFirst([{ closed: false, vertices: open[0].vertices.slice(0, 2) }], [10, 10], 6)).toBe(false);
    expect(closesOnFirst([{ ...open[0], closed: true }], [10, 10], 6)).toBe(false);
  });
});

describe('corner radius handles', () => {
  const box = { left: 100, top: 50, width: 200, height: 100 };

  it('sit on each corner, top-left first, clockwise', () => {
    expect([0, 1, 2, 3].map((i) => cornerAt(box, i))).toEqual([
      [100, 50],
      [300, 50],
      [300, 150],
      [100, 150]
    ]);
  });

  it('dragging a handle inward along the diagonal is the inset of that corner', () => {
    expect(cornerInset(box, 0, [120, 70])).toBe(20);
    expect(cornerInset(box, 2, [270, 120])).toBe(30);
  });

  it('dragging outward is no inset', () => {
    expect(cornerInset(box, 1, [320, 30])).toBe(0);
  });
});

describe('a click with a box tool', () => {
  it('starts the box at the click, top-left, not centred on it', () => {
    expect(clickBox({ x: 100, y: 50 }, { width: 200, height: 40 })).toEqual({ x: 200, y: 70, width: 200, height: 40 });
  });
});
