import { describe, expect, it } from 'vitest';
import { pointerAt, rippleAt } from './pointer';

const REST = { x: 800, y: 450 };

describe('demo pointer', () => {
  it('rests before the first sample', () => {
    expect(pointerAt([{ t: 1, x: 10, y: 10 }], 0, REST)).toEqual(REST);
  });

  it('interpolates between samples so the cursor moves at any frame rate', () => {
    const samples = [
      { t: 1, x: 0, y: 0 },
      { t: 2, x: 100, y: 50 }
    ];
    expect(pointerAt(samples, 1.5, REST)).toEqual({ x: 50, y: 25 });
  });

  it('holds the last sample after the path ends', () => {
    expect(pointerAt([{ t: 1, x: 10, y: 20 }], 9, REST)).toEqual({ x: 10, y: 20 });
  });

  it('ripples only just after a press', () => {
    expect(rippleAt([2], 1.9)).toBeNull();
    expect(rippleAt([2], 2.1)).toBeGreaterThan(0);
    expect(rippleAt([2], 3)).toBeNull();
  });
});
