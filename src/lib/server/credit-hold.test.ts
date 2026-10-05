import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { kind: 'grant' | 'debit'; source: string; amount: number; expires_at: string | null };

const ledger = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], inserted: [] as Record<string, unknown>[] }));

vi.mock('$lib/server/supabase-admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: async () => ({ data: ledger.rows, error: null }) }),
      insert: async (row: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(row) ? row : [row];
        ledger.inserted.push(...rows);
        ledger.rows.push(...rows);
        return { error: null };
      }
    })
  })
}));

import { holdCredits, portionsOf, releaseCredits, splitPortions } from './credit-hold';

const NOW = new Date('2026-10-05T12:00:00Z');
const SOON = '2026-10-10T00:00:00.000Z';
const LATER = '2026-11-01T00:00:00.000Z';
const PAST = '2026-10-01T00:00:00.000Z';

const grant = (amount: number, expires_at: string | null, source = 'promo'): Row => ({ kind: 'grant', source, amount, expires_at });
const debit = (amount: number): Row => ({ kind: 'debit', source: 'ai_usage', amount, expires_at: null });

describe('which credits a hold takes', () => {
  it('spending takes the credits that expire first, so a hold does too', () => {
    expect(portionsOf([grant(100, null, 'subscription_renewal'), grant(50, SOON)], 30, NOW)).toEqual([{ amount: 30, expiresAt: SOON }]);
  });

  it('what earlier spending already took is not taken again', () => {
    expect(portionsOf([grant(100, null), grant(50, SOON), debit(40)], 30, NOW)).toEqual([
      { amount: 10, expiresAt: SOON },
      { amount: 20, expiresAt: null }
    ]);
  });

  it('expired credits are not there to take', () => {
    expect(portionsOf([grant(100, null), grant(50, PAST)], 30, NOW)).toEqual([{ amount: 30, expiresAt: null }]);
  });

  it('two expiring grants are taken soonest first', () => {
    expect(portionsOf([grant(20, LATER), grant(20, SOON)], 30, NOW)).toEqual([
      { amount: 20, expiresAt: SOON },
      { amount: 10, expiresAt: LATER }
    ]);
  });

  it('a balance short of the hold takes nothing', () => {
    expect(portionsOf([grant(20, null)], 30, NOW)).toBeNull();
  });
});

describe('one hold for many renders', () => {
  it('is split in order, each render keeping the expiry of the credits it took', () => {
    const held = [{ amount: 10, expiresAt: SOON }, { amount: 20, expiresAt: null }];

    expect(splitPortions(held, [6, 6, 18])).toEqual([[{ amount: 6, expiresAt: SOON }], [{ amount: 4, expiresAt: SOON }, { amount: 2, expiresAt: null }], [{ amount: 18, expiresAt: null }]]);
  });
});

describe('hold and release', () => {
  beforeEach(() => {
    ledger.rows = [];
    ledger.inserted = [];
  });

  it('released credits come back with the expiry they were held with', async () => {
    ledger.rows = [grant(50, SOON, 'promo'), grant(100, null, 'subscription_renewal')];

    const portions = await holdCredits('org', 70, 'hold', NOW);
    await releaseCredits('org', portions!, 'release');

    const back = ledger.inserted.filter((r) => r.kind === 'grant');
    expect(back).toEqual([
      expect.objectContaining({ org_id: 'org', source: 'refund', amount: 50, expires_at: SOON }),
      expect.objectContaining({ org_id: 'org', source: 'refund', amount: 20, expires_at: null })
    ]);
  });

  it('a hold the balance cannot cover writes nothing', async () => {
    ledger.rows = [grant(10, null)];

    expect(await holdCredits('org', 70, 'hold', NOW)).toBeNull();
    expect(ledger.inserted).toEqual([]);
  });
});
