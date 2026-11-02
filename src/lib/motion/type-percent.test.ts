import { describe, expect, it } from 'vitest';
import { percentShown, percentStored } from './type-percent';

describe('fields typed in percent', () => {
  it('an arc sweep of half the ellipse reads 50%', () => {
    expect(percentShown('arcSweep', 0.5)).toBe(50);
    expect(percentStored('arcSweep', 50)).toBe(0.5);
  });

  it('an arc ratio reads in percent', () => {
    expect(percentShown('arcRatio', 0.25)).toBe(25);
  });

  it('a field outside the list is untouched', () => {
    expect(percentShown('arcStart', 90)).toBe(90);
  });
});
