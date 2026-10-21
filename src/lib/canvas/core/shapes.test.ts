import { describe, expect, it } from 'vitest';
import { roundRect } from './shapes';

describe('roundRect', () => {
  it('rounds corners by a radius in pixels, not a share of the side', () => {
    const [outline] = roundRect(0, 0, 100, 32, 4);
    const onTop = outline.filter((_, i) => i % 2 === 0).filter((_, i) => Math.abs(outline[2 * i + 1]) < 1e-6);

    expect(Math.min(...onTop)).toBeCloseTo(4, 3);
  });
});
