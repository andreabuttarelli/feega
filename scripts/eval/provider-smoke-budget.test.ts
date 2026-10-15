import { describe, expect, it } from 'vitest';
import { nextFits, overspent, planFits } from './provider-smoke-budget';

describe('the provider smoke never passes $1', () => {
  it('refuses a plan whose worst case passes the cap before any call', () => {
    expect(planFits([{ provider: 'a', maxUsd: 0.6 }, { provider: 'b', maxUsd: 0.5 }])).toMatchObject({ ok: false });
  });

  it('accepts a plan under the cap', () => {
    expect(planFits([{ provider: 'a', maxUsd: 0.1 }, { provider: 'b', maxUsd: 0.2 }])).toEqual({ ok: true });
  });

  it('stops before a call that could pass the cap given what was really spent', () => {
    expect(nextFits(0.95, { provider: 'kie', maxUsd: 0.06 })).toMatchObject({ ok: false });
  });

  it('flags a provider that billed more than it was allowed', () => {
    expect(overspent(0.2, { provider: 'kie', maxUsd: 0.06 })).toBe(true);
    expect(overspent(null, { provider: 'kie', maxUsd: 0.06 })).toBe(false);
  });
});
