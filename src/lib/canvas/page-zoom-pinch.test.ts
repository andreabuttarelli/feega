import { describe, expect, it } from 'vitest';
import { pinchFactors } from './page-zoom';

describe('pinchFactors', () => {
  it('turns cumulative gesture scale into per-event ratios', () => {
    const f = pinchFactors();
    f.start();
    expect(f.next(1.2)).toBeCloseTo(1.2);
    expect(f.next(1.5)).toBeCloseTo(1.25);
  });

  it('restarts from 1 on a new gesture', () => {
    const f = pinchFactors();
    f.next(2);
    f.start();
    expect(f.next(1.1)).toBeCloseTo(1.1);
  });
});
