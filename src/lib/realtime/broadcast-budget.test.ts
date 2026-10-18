import { describe, expect, it } from 'vitest';
import { MAX_HZ, Plan, PLAN_LIMITS, budgetOf, fitsPlan, hzFor } from './broadcast-budget';

describe('budgetOf', () => {
  it('counts every message once per receiver', () => {
    expect(budgetOf({ peers: 5, hz: 20, draggers: 1, dragHz: 0 })).toEqual({ sent: 100, received: 400 });
  });

  it('a drag on its own stream costs more than one coalesced into the tick', () => {
    expect(budgetOf({ peers: 5, hz: 20, draggers: 1, dragHz: 0 }).received)
      .toBeLessThan(budgetOf({ peers: 5, hz: 20, draggers: 1, dragHz: 30 }).received);
  });

  it('a single peer receives nothing', () => {
    expect(budgetOf({ peers: 1, hz: 20, draggers: 0, dragHz: 0 })).toEqual({ sent: 20, received: 0 });
  });
});

describe('fitsPlan', () => {
  it('uses the published limits', () => {
    expect(PLAN_LIMITS[Plan.Pro].messagesPerSecond).toBe(500);
    expect(PLAN_LIMITS[Plan.Team].messagesPerSecond).toBe(2500);
  });

  it('five peers at 20 Hz fit Pro, ten do not', () => {
    expect(fitsPlan(budgetOf({ peers: 5, hz: 20, draggers: 0, dragHz: 0 }), Plan.Pro)).toBe(true);
    expect(fitsPlan(budgetOf({ peers: 10, hz: 20, draggers: 0, dragHz: 0 }), Plan.Pro)).toBe(false);
  });
});

describe('hzFor', () => {
  it('runs at full rate up to five peers on Pro', () => {
    expect(hzFor(1, Plan.Pro)).toBe(MAX_HZ);
    expect(hzFor(5, Plan.Pro)).toBe(MAX_HZ);
  });

  it('slows down past that so the canvas stays inside the quota', () => {
    for (const peers of [6, 10, 20]) {
      const hz = hzFor(peers, Plan.Pro);
      expect(hz).toBeLessThan(MAX_HZ);
      expect(fitsPlan(budgetOf({ peers, hz, draggers: 0, dragHz: 0 }), Plan.Pro)).toBe(true);
    }
  });

  it('never stops sending entirely', () => {
    expect(hzFor(500, Plan.Pro)).toBeGreaterThan(0);
  });
});
