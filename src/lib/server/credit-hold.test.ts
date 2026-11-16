import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { org_id: string; kind: 'grant' | 'debit'; source: string; amount: number; note?: string };

const db = vi.hoisted(() => ({ rows: [] as Row[], rpcs: [] as { name: string; args: Record<string, unknown> }[] }));

const balanceOf = (org: string) => db.rows.filter((r) => r.org_id === org).reduce((sum, r) => sum + (r.kind === 'grant' ? r.amount : -r.amount), 0);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

vi.mock('$lib/server/supabase-admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
          then: async (done: (r: unknown) => unknown) => {
            const snapshot = [...db.rows];
            await tick();
            return done({ data: snapshot, error: null });
          }
        };
        return query;
      },
      insert: async (row: Row | Row[]) => {
        db.rows.push(...(Array.isArray(row) ? row : [row]));
        return { error: null };
      }
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      db.rpcs.push({ name, args });
      if (name === 'credit_hold') {
        const amounts = args._amounts as number[];
        const keys = args._keys as string[];
        const total = amounts.reduce((a, b) => a + b, 0);
        if (balanceOf(args._org_id as string) < total) {
          return { data: false, error: null };
        }
        keys.forEach((key, i) => db.rows.push({ org_id: args._org_id as string, kind: 'debit', source: 'ai_usage', amount: amounts[i], note: key }));
        return { data: true, error: null };
      }
      if (name === 'credit_release') {
        return { data: 70, error: null };
      }
      if (name === 'credit_release_stale') {
        return { data: 2, error: null };
      }
      return { data: null, error: { message: `unknown ${name}` } };
    }
  })
}));

import { holdCredits, refundHold, releaseStaleHolds } from './credit-hold';

beforeEach(() => {
  db.rows = [{ org_id: 'org', kind: 'grant', source: 'promo', amount: 100 }];
  db.rpcs = [];
});

describe('a hold is decided by the database, not by a balance the app computed', () => {
  it('two holds racing for a balance that fits one: only one is taken', async () => {
    const outcomes = await Promise.all([holdCredits('org', [{ amount: 60, note: 'a' }]), holdCredits('org', [{ amount: 60, note: 'b' }])]);

    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(balanceOf('org')).toBe(40);
  });

  it('asks credit_hold for every key and amount in one call', async () => {
    await holdCredits('org', [{ amount: 30, note: 'a' }, { amount: 40, note: 'b' }]);

    expect(db.rpcs).toEqual([{ name: 'credit_hold', args: { _org_id: 'org', _keys: ['a', 'b'], _amounts: [30, 40] } }]);
  });

  it('a refund is the database releasing the hold under its key', async () => {
    expect(await refundHold('org', 'a')).toBe(70);
    expect(db.rpcs).toEqual([{ name: 'credit_release', args: { _org_id: 'org', _key: 'a' } }]);
  });

  it('holds nobody settled within a day are released by the reconciler', async () => {
    expect(await releaseStaleHolds()).toBe(2);
    expect(db.rpcs).toEqual([{ name: 'credit_release_stale', args: { _older_than: '1 day' } }]);
  });
});
