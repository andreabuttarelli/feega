import { describe, expect, it } from 'vitest';
import { fractionIn, isOutside } from './canvas-drop';

describe('where a drop lands inside a frame', () => {
  const stage = { left: 100, top: 50, width: 200, height: 100 };

  it('is the fraction of the frame stage under the pointer', () => {
    expect(fractionIn(stage, { x: 150, y: 75 })).toEqual({ x: 0.25, y: 0.25 });
  });

  it('a point just outside the stage edge is held on the edge', () => {
    expect(fractionIn(stage, { x: 90, y: 200 })).toEqual({ x: 0, y: 1 });
  });
});

describe('an element dragged off its frame', () => {
  const stage = { left: 0, top: 0, width: 100, height: 100 };

  it('is outside once the pointer leaves the stage, not before', () => {
    expect(isOutside(stage, { x: 100, y: 50 })).toBe(false);
    expect(isOutside(stage, { x: 101, y: 50 })).toBe(true);
    expect(isOutside(stage, { x: 50, y: -1 })).toBe(true);
  });
});
