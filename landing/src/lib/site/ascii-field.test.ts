import { describe, expect, it } from 'vitest';
import { FLAG_COUNT, FLAG_HOLD_MS, RAMP, envelope, flagTint, fieldAt, glyphFor, gridSize, tint } from './ascii-field';

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

  it('runs the pride rainbow from red to violet', () => {
    const [r0, , b0] = tint(0);
    const [r1, , b1] = tint(1);
    expect(r0).toBeGreaterThan(b0);
    expect(b1).toBeGreaterThan(100);
  });

  it('passes through yellow and green', () => {
    const samples = Array.from({ length: 101 }, (_, i) => tint(i / 100));
    expect(samples.some(([r, g, b]) => r > 200 && g > 200 && b < 80)).toBe(true);
    expect(samples.some(([r, g, b]) => g > r + 40 && g > b + 40)).toBe(true);
  });

  it('blends between stripes without hard bands', () => {
    for (let t = 0; t < 1; t += 0.01) {
      const a = tint(t);
      const b = tint(t + 0.01);
      expect(Math.max(...a.map((v, i) => Math.abs(v - b[i])))).toBeLessThan(32);
    }
  });
});

describe('envelope', () => {
  it('peaks at the centre and fades evenly to the edges', () => {
    expect(envelope(0.5, 0.5)).toBeCloseTo(1, 5);
    expect(envelope(0, 0.5)).toBeCloseTo(envelope(1, 0.5), 9);
    expect(envelope(0.5, 0)).toBeCloseTo(envelope(0.5, 1), 9);
    expect(envelope(0, 0)).toBeLessThan(envelope(0.3, 0.3));
  });
});

describe('tint', () => {
  it('keeps every stop bright on black', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      expect(Math.max(...tint(t))).toBeGreaterThanOrEqual(170);
    }
  });
});

describe('flag cycle', () => {
  const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) <= 1);

  it('holds one flag, then the next', () => {
    expect(close(flagTint(0.5, 1000, 0), flagTint(0.5, 0, 0))).toBe(true);
    expect(close(flagTint(0.5, FLAG_HOLD_MS + 10, 0), flagTint(0.5, 0, 1))).toBe(true);
  });

  it('cross-fades without a jump', () => {
    for (let ms = 0; ms < FLAG_HOLD_MS * 2; ms += 16) {
      const a = flagTint(0.3, ms, 2);
      const b = flagTint(0.3, ms + 16, 2);
      expect(Math.max(...a.map((v, i) => Math.abs(v - b[i])))).toBeLessThan(12);
    }
  });

  it('keeps every flag visible on black', () => {
    for (let f = 0; f < FLAG_COUNT; f++) {
      for (let t = 0; t <= 1; t += 0.05) {
        expect(Math.max(...flagTint(t, 0, f))).toBeGreaterThanOrEqual(150);
      }
    }
  });
});
