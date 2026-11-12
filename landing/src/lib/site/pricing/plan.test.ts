import { describe, expect, it } from 'vitest';
import { CLIP, FREE_UNITS, IMAGE, PLAN_LOW, PLAN_STANDARD, estimate, includedCredits, outcomesIn } from './plan';

describe('what credits get you', () => {
  it('reads included credits from the plan, not from its price', () => {
    expect(includedCredits(PLAN_LOW)).toBe(5);
    expect(includedCredits(PLAN_STANDARD)).toBe(18);
  });

  it('charges the model price plus the markup, rounding down', () => {
    expect(outcomesIn(PLAN_STANDARD.includedUnits, IMAGE)).toBe(200);
    expect(outcomesIn(PLAN_STANDARD.includedUnits, CLIP)).toBe(39);
    expect(outcomesIn(PLAN_LOW.includedUnits, IMAGE)).toBe(55);
    expect(outcomesIn(PLAN_LOW.includedUnits, CLIP)).toBe(10);
    expect(outcomesIn(FREE_UNITS, IMAGE)).toBe(11);
  });

  it('asks for a top-up only past the included credits', () => {
    expect(estimate(PLAN_LOW, 50, 0)).toEqual({ credits: 5, topUp: 0 });
    expect(estimate(PLAN_LOW, 100, 5)).toEqual({ credits: 12, topUp: 7 });
    expect(estimate(PLAN_STANDARD, 100, 5)).toEqual({ credits: 12, topUp: 0 });
  });
});
