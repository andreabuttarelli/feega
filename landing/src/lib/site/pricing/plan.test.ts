import { describe, expect, it } from 'vitest';
import { CLIP, FREE_CREDITS, IMAGE, PLAN, bringYourAgent, estimate, outcomesIn, topUpPrices } from './plan';

describe('what credits get you', () => {
  it('charges 120 credits per provider dollar, rounding down', () => {
    expect(outcomesIn(PLAN.includedCredits, IMAGE)).toBe(55);
    expect(outcomesIn(PLAN.includedCredits, CLIP)).toBe(10);
    expect(outcomesIn(FREE_CREDITS, IMAGE)).toBe(11);
  });

  it('fits in the plan until the included credits run out', () => {
    expect(estimate(PLAN, 1, 50, 0)).toEqual({ cost: 9, included: 500, credits: 449, gap: 0, topUps: [] });
  });

  it('picks the smallest top-up that covers the gap', () => {
    expect(estimate(PLAN, 1, 100, 5).topUps.map((t) => t.price)).toEqual([10]);
    expect(estimate(PLAN, 1, 150, 10).topUps.map((t) => t.price)).toEqual([20]);
  });

  it('adds the smallest top-up for what the largest leaves', () => {
    expect(estimate(PLAN, 1, 600, 60).topUps.map((t) => t.price)).toEqual([50, 50]);
    expect(estimate(PLAN, 1, 600, 3).topUps.map((t) => t.price)).toEqual([50, 10]);
  });

  it('pools each editor\'s credits and price', () => {
    const three = estimate(PLAN, 3, 150, 10);
    expect([three.cost, three.included, three.gap]).toEqual([27, 1500, 303]);
    expect(three.topUps.map((t) => t.price)).toEqual([10]);
  });

  it('lists every top-up price', () => {
    expect(topUpPrices(PLAN)).toBe('€10, €20 or €50');
  });

  it('states the free agent cap from the plan', () => {
    expect(bringYourAgent({ ...PLAN, freeAgentLayersPerWeek: 2500 })).toContain('2,500 agent-made layers a week');
  });
});
