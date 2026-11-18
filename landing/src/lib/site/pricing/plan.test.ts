import { describe, expect, it } from 'vitest';
import { CLIP, FREE_CREDITS, IMAGE, PLAN, bringYourAgent, outcomesIn, topUpPrices } from './plan';

describe('what credits get you', () => {
  it('charges 120 credits per provider dollar, rounding down', () => {
    expect(outcomesIn(PLAN.includedCredits, IMAGE)).toBe(55);
    expect(outcomesIn(PLAN.includedCredits, CLIP)).toBe(10);
    expect(outcomesIn(FREE_CREDITS, IMAGE)).toBe(11);
  });

  it('lists every top-up price', () => {
    expect(topUpPrices(PLAN)).toBe('€10, €20 or €50');
  });

  it('states the free agent cap from the plan', () => {
    expect(bringYourAgent({ ...PLAN, freeAgentLayersPerWeek: 2500 })).toContain('2,500 agent-made layers in any 7 days');
  });
});
