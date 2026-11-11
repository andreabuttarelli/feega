import { describe, expect, it } from 'vitest';
import { RAMP, fieldAt, glyphFor, gridSize, tint } from './ascii-field';

describe('ascii field', () => {
  it('stays in 0..1', () => {
    for (let i = 0; i < 500; i++) {
      const v = fieldAt(i * 0.37, i * 0.11, i / 500);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('loops seamlessly: phase 0 equals phase 1', () => {
    for (let i = 0; i < 50; i++) {
      expect(fieldAt(i * 1.3, i * 0.7, 0)).toBeCloseTo(fieldAt(i * 1.3, i * 0.7, 1), 9);
    }
  });

  it('moves smoothly between close phases', () => {
    expect(Math.abs(fieldAt(3, 4, 0.5) - fieldAt(3, 4, 0.501))).toBeLessThan(0.02);
  });

  it('maps density to the ramp ends', () => {
    expect(glyphFor(0)).toBe(RAMP[0]);
    expect(glyphFor(1)).toBe(RAMP[RAMP.length - 1]);
  });

  it('caps the grid', () => {
    const big = gridSize(4000, 3000, 14);
    expect(big.cols * big.rows).toBeLessThanOrEqual(12000);
    expect(gridSize(390, 700, 10).cols).toBeGreaterThan(0);
  });

  it('starts from brand orange on the left', () => {
    expect(tint(0)).toEqual([255, 81, 0]);
    expect(tint(1)).not.toEqual([255, 81, 0]);
  });
});
