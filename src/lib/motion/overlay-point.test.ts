import { describe, expect, it } from 'vitest';
import { fractionIn, unturnedWidth } from './overlay-point';

const upright = { left: 100, top: 50, width: 200, height: 100 };
const layout = { width: 200, height: 100 };
const quarterTurned = { left: 150, top: 0, width: 100, height: 200 };

describe('fractionIn', () => {
  it('reads a point of an upright host as a fraction of its box', () => {
    expect(fractionIn({ x: 200, y: 75 }, upright, layout, 0)).toEqual({ x: 0.5, y: 0.25 });
  });

  it('reads the centre of a turned host as 0.5,0.5', () => {
    const got = fractionIn({ x: 200, y: 100 }, quarterTurned, layout, 90);
    expect(got.x).toBeCloseTo(0.5);
    expect(got.y).toBeCloseTo(0.5);
  });

  it('reads the host own top-left corner as 0,0 once turned a quarter', () => {
    const got = fractionIn({ x: 250, y: 0 }, quarterTurned, layout, 90);
    expect(got.x).toBeCloseTo(0);
    expect(got.y).toBeCloseTo(0);
  });
});

describe('unturnedWidth', () => {
  it('is the box width when upright and the layout width when turned', () => {
    expect(unturnedWidth(upright, { width: 150, height: 100 }, 0)).toBe(200);
    expect(unturnedWidth(upright, { width: 150, height: 100 }, 20)).toBe(150);
  });
});
