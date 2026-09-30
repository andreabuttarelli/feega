import { describe, expect, it, vi } from 'vitest';
import { latestRefund } from './refund-status';
import { RefundReason } from '$lib/billing/refund-policy';

type Row = {
  id: string;
  kind: 'grant' | 'debit';
  source: string;
  amount: number;
  created_at: string;
  expires_at: string | null;
  stripe_checkout_id?: string | null;
  stripe_invoice_id?: string | null;
};

function fakeDb(rows: Row[]) {
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: () => q,
    eq: () => q,
    then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: rows, error: null })
  });
  return { from: (table: string) => (table === 'credit_ledger' ? q : null) } as never;
}

const now = new Date('2026-09-05T00:00:00Z');
const noFee = async () => 0;

describe('latestRefund', () => {
  it('is null without any paid purchase', async () => {
    const db = fakeDb([
      { id: 'w', kind: 'grant', source: 'promo', amount: 500, created_at: '2026-09-01', expires_at: '2026-09-15' }
    ]);

    expect(await latestRefund(db, 'org-1', now, noFee)).toBeNull();
  });

  it('prices a top-up at 1 € per credit and deducts what was spent from it and the processing fee', async () => {
    const feeOf = vi.fn(async () => 0.5);
    const db = fakeDb([
      { id: 't', kind: 'grant', source: 'one_time_purchase', amount: 1600, created_at: '2026-09-02', expires_at: null, stripe_checkout_id: 'cs_1' },
      { id: 'd', kind: 'debit', source: 'ai_usage', amount: 100, created_at: '2026-09-03', expires_at: null }
    ]);

    expect(await latestRefund(db, 'org-1', now, feeOf)).toEqual({
      eligible: true,
      amount: 14.5,
      reason: RefundReason.WithinWindow,
      until: new Date('2026-09-16T00:00:00Z'),
      maxCreditsUsable: 1.6
    });
    expect(feeOf).toHaveBeenCalledWith({ checkoutId: 'cs_1', invoiceId: null });
  });

  it('treats a second subscription grant as a renewal with a 48-hour window', async () => {
    const db = fakeDb([
      { id: 's1', kind: 'grant', source: 'subscription_renewal', amount: 800, created_at: '2026-08-04T00:00:00Z', expires_at: '2026-09-04T00:00:00Z' },
      { id: 's2', kind: 'grant', source: 'subscription_renewal', amount: 800, created_at: '2026-09-04T00:00:00Z', expires_at: '2026-10-04T00:00:00Z' }
    ]);

    expect(await latestRefund(db, 'org-1', now, noFee)).toMatchObject({
      eligible: true,
      amount: 8,
      until: new Date('2026-09-06T00:00:00Z')
    });
  });
});
