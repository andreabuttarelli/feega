import { describe, expect, it } from 'vitest';
import { fractionIn } from './host-point';

const upright = { left: 100, top: 50, width: 200, height: 100 };

describe('a pointer read inside an overlay host', () => {
  it('maps an upright host by its box', () => {
    expect(fractionIn(upright, { width: 200, height: 100 }, 0, [150, 75])).toEqual([0.25, 0.25]);
  });

  it('maps a host drawn smaller than its layout size', () => {
    expect(fractionIn(upright, { width: 400, height: 200 }, 0, [300, 150])).toEqual([1, 1]);
  });

  it('undoes the turn of a rotated host', () => {
    const turned = { left: 150, top: 0, width: 100, height: 200 };
    const [x, y] = fractionIn(turned, { width: 200, height: 100 }, 90, [250, 200]);

    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
  });
});
