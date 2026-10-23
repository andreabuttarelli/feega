import { describe, expect, it } from 'vitest';
import { SwipeStep, adjacentFrame, swipeStep } from './frame-viewer';

const FRAMES = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('adjacentFrame', () => {
  it('moves to the next and previous frame', () => {
    expect(adjacentFrame(FRAMES, 'b', SwipeStep.Next)).toBe('c');
    expect(adjacentFrame(FRAMES, 'b', SwipeStep.Previous)).toBe('a');
  });

  it('stops at both ends', () => {
    expect(adjacentFrame(FRAMES, 'c', SwipeStep.Next)).toBeNull();
    expect(adjacentFrame(FRAMES, 'a', SwipeStep.Previous)).toBeNull();
  });

  it('an unknown frame has no neighbour', () => {
    expect(adjacentFrame(FRAMES, 'zzz', SwipeStep.Next)).toBeNull();
  });
});

describe('swipeStep', () => {
  it('a left swipe goes to the next frame, a right swipe to the previous', () => {
    expect(swipeStep(-120, 4)).toBe(SwipeStep.Next);
    expect(swipeStep(120, -4)).toBe(SwipeStep.Previous);
  });

  it('a short drag is a tap, not a swipe', () => {
    expect(swipeStep(-10, 0)).toBe(SwipeStep.None);
  });

  it('a mostly vertical drag is a scroll, not a swipe', () => {
    expect(swipeStep(-80, 200)).toBe(SwipeStep.None);
  });
});
