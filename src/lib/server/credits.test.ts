import { describe, it, expect } from 'vitest';
import { productionCredits } from './plan-budget';
import {
  creditQuota,
  CreditsExhaustedError,
  assertCreditsAvailable,
  type CreditsUsage
} from './credits';

describe('creditQuota', () => {
  // Le cifre non si fissano più a mano: derivano da prezzo × (1 − margine) e cambiano col listino.
  // Fissarle qui obbligava a modificare i test a ogni ritocco di prezzo, e un test che si aggiorna
  // per abitudine smette di accorgersi di un errore.
  it('è il budget di produzione del piano', () => {
    for (const key of ['go', 'starter', 'pro'] as const) {
      expect(creditQuota(key)).toBe(productionCredits(key));
    }
  });

  it('cresce col prezzo del piano', () => {
    expect(creditQuota('pro')).toBeGreaterThan(creditQuota('starter'));
    expect(creditQuota('starter')).toBeGreaterThan(creditQuota('go'));
  });

  it('legacy scale resta agganciato a pro (grandfathered)', () => {
    expect(creditQuota('scale')).toBe(creditQuota('pro'));
  });

  it('a free or unknown plan has no monthly quota: its credits are the one-time signup grant', () => {
    expect(creditQuota(null)).toBe(0);
    expect(creditQuota(undefined)).toBe(0);
    expect(creditQuota('some-unknown-plan')).toBe(0);
  });

  it('gives the free plan no credits', () => {
    expect(creditQuota(null)).toBe(0);
  });
});

describe('assertCreditsAvailable', () => {
  const makeUsage = (remaining: number): CreditsUsage => ({
    used: 1000,
    quota: 1500,
    bonus: 0,
    remaining,
    periodStart: new Date(),
    periodEnd: new Date(),
    percent: 66
  });

  it('does nothing when credits remain', () => {
    expect(() => assertCreditsAvailable(makeUsage(500))).not.toThrow();
  });

  it('does nothing when remaining is exactly 0 — edge case, throw', () => {
    expect(() => assertCreditsAvailable(makeUsage(0))).toThrow(CreditsExhaustedError);
  });

  it('throws CreditsExhaustedError when exhausted', () => {
    try {
      assertCreditsAvailable(makeUsage(0));
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CreditsExhaustedError);
      expect((e as CreditsExhaustedError).name).toBe('CreditsExhaustedError');
      expect((e as CreditsExhaustedError).usage.remaining).toBe(0);
    }
  });
});

describe('CreditsExhaustedError', () => {
  it('carries the usage object', () => {
    const usage: CreditsUsage = {
      used: 1500,
      quota: 2000,
      bonus: 500,
      remaining: 0,
      periodStart: new Date('2026-07-15'),
      periodEnd: new Date('2026-08-15'),
      percent: 100
    };
    const err = new CreditsExhaustedError(usage);
    expect(err.message).toBe('AI credits exhausted for this billing period');
    expect(err.usage).toBe(usage);
    expect(err.usage.bonus).toBe(500);
    expect(err.usage.percent).toBe(100);
  });
});

