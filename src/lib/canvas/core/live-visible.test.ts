import { describe, expect, it } from 'vitest';
import { liveCovers, type Edges } from './live-visible';

const screen: Edges = { left: 0, top: 0, right: 1000, bottom: 800 };

describe('a live editor that really shows its frame', () => {
  it('covers the view when it has size and overlaps the screen', () => {
    expect(liveCovers({ left: -500, top: -500, right: 1500, bottom: 1500 }, screen)).toBe(true);
    expect(liveCovers({ left: 900, top: 700, right: 1400, bottom: 1200 }, screen)).toBe(true);
  });

  it('does not cover when it has no size, or is off screen', () => {
    expect(liveCovers({ left: 100, top: 100, right: 100, bottom: 400 }, screen)).toBe(false);
    expect(liveCovers({ left: 1200, top: 0, right: 1600, bottom: 400 }, screen)).toBe(false);
  });

  it('does not cover when there is nothing to measure', () => {
    expect(liveCovers(null, screen)).toBe(false);
  });
});
