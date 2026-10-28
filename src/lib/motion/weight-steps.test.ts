import { describe, expect, it } from 'vitest';
import { snappedValue, steppedRange } from './weight-steps';

const FREE = { min: 100, max: 1000, step: 1 };

describe('weight in the inspector', () => {
  it('steps in hundreds from 100 to 900', () => {
    expect(steppedRange('weight', FREE)).toEqual({ min: 100, max: 900, step: 100 });
  });

  it('snaps any value to the nearest hundred', () => {
    expect(snappedValue('weight', 440)).toBe(400);
    expect(snappedValue('weight', 450)).toBe(500);
    expect(snappedValue('weight', 59)).toBe(100);
    expect(snappedValue('weight', 1000)).toBe(900);
  });

  it('leaves every other field alone', () => {
    expect(steppedRange('size', { min: 0.01, max: 1.2, step: 0.005 })).toEqual({ min: 0.01, max: 1.2, step: 0.005 });
    expect(snappedValue('size', 0.123)).toBe(0.123);
  });
});
