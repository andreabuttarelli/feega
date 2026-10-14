import { describe, expect, it } from 'vitest';
import { Corner, dragRect, nudge, resizeFromCorner, roundnessFromInset } from './draw-tool';

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
