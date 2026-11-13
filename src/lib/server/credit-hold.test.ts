import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { kind: 'grant' | 'debit'; source: string; amount: number; expires_at: string | null };

const ledger = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], inserted: [] as Record<string, unknown>[] }));

vi.mock('$lib/server/supabase-admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => {
        const filters: [string, unknown][] = [];
        const query = {
          eq: (column: string, value: unknown) => (filters.push([column, value]), query),
          then: (done: (r: unknown) => unknown) => done({ data: ledger.rows.filter((r) => filters.every(([c, v]) => c === 'org_id' || r[c] === v)), error: null })
        };
        return query;
      },
      insert: async (row: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(row) ? row : [row];
        ledger.inserted.push(...rows);
        ledger.rows.push(...rows);
        return { error: null };
      }
    })
  })
}));

import { holdCredits, portionsOf, refundHold } from './credit-hold';

const SOON = '2026-10-10T00:00:00.000Z';
const LATER = '2026-11-01T00:00:00.000Z';
const PAST = '2026-10-01T00:00:00.000Z';

const grant = (amount: number, expires_at: string | null, source = 'promo'): Row => ({ kind: 'grant', source, amount, expires_at });
const debit = (amount: number): Row => ({ kind: 'debit', source: 'ai_usage', amount, expires_at: null });

describe('which credits a hold takes', () => {
  it('spending takes the credits that expire first, so a hold does too', () => {
    expect(portionsOf([grant(100, null, 'subscription_renewal'), grant(50, SOON)], 30)).toEqual([{ amount: 30, expiresAt: SOON }]);
  });

  it('what earlier spending already took is not taken again', () => {
    expect(portionsOf([grant(100, null), grant(50, SOON), debit(40)], 30)).toEqual([
      { amount: 10, expiresAt: SOON },
      { amount: 20, expiresAt: null }
    ]);
  });

  it('a grant past its old expiry date is still there to take, as the balance counts it', () => {
    expect(portionsOf([grant(50, PAST)], 30)).toEqual([{ amount: 30, expiresAt: PAST }]);
  });

  it('two expiring grants are taken soonest first', () => {
    expect(portionsOf([grant(20, LATER), grant(20, SOON)], 30)).toEqual([
      { amount: 20, expiresAt: SOON },
      { amount: 10, expiresAt: LATER }
    ]);
  });

  it('a balance short of the hold takes nothing', () => {
    expect(portionsOf([grant(20, null)], 30)).toBeNull();
  });
});

describe('hold and refund', () => {
  beforeEach(() => {
    ledger.rows = [];
    ledger.inserted = [];
  });

  it('holds every amount under its own note, after one balance check for the total', async () => {
    ledger.rows = [grant(100, null)];

    expect(await holdCredits('org', [{ amount: 30, note: 'a' }, { amount: 40, note: 'b' }])).toBe(true);
    expect(ledger.inserted).toEqual([
      expect.objectContaining({ org_id: 'org', kind: 'debit', amount: 30, note: 'a' }),
      expect.objectContaining({ org_id: 'org', kind: 'debit', amount: 40, note: 'b' })
    ]);
  });

  it('a hold the balance cannot cover writes nothing', async () => {
    ledger.rows = [grant(10, null)];

    expect(await holdCredits('org', [{ amount: 70, note: 'a' }])).toBe(false);
    expect(ledger.inserted).toEqual([]);
  });

  it('a refund pays back what the ledger holds under that note, and only once', async () => {
    ledger.rows = [grant(100, null)];
    await holdCredits('org', [{ amount: 70, note: 'a' }, { amount: 20, note: 'b' }]);

    expect(await refundHold('org', 'a')).toBe(70);
    expect(await refundHold('org', 'a')).toBe(70);

    expect(ledger.inserted.filter((r) => r.kind === 'grant')).toEqual([expect.objectContaining({ org_id: 'org', source: 'refund', amount: 70, note: 'a' })]);
  });

  it('a refund with no hold under its note pays nothing', async () => {
    ledger.rows = [grant(100, null)];

    expect(await refundHold('org', 'nothing held')).toBe(0);
    expect(ledger.inserted).toEqual([]);
  });
});
