import { describe, expect, it } from 'vitest';
import { CLIP, FREE_CREDITS, IMAGE, PLAN_LOW, PLAN_STANDARD, estimate, outcomesIn } from './plan';

describe('what credits get you', () => {
  it('charges the model price plus the markup, rounding down', () => {
    expect(outcomesIn(PLAN_STANDARD.credits, IMAGE)).toBe(200);
    expect(outcomesIn(PLAN_STANDARD.credits, CLIP)).toBe(39);
    expect(outcomesIn(PLAN_LOW.credits, IMAGE)).toBe(100);
    expect(outcomesIn(PLAN_LOW.credits, CLIP)).toBe(19);
    expect(outcomesIn(FREE_CREDITS, IMAGE)).toBe(11);
  });

  it('asks for top-ups only past the included credits', () => {
    expect(estimate(PLAN_STANDARD, 200, 0)).toEqual({ credits: 18, extra: 0 });
    expect(estimate(PLAN_LOW, 200, 10)).toEqual({ credits: 23, extra: 14 });
  });
});
