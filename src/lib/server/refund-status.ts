import type { SupabaseClient } from '@supabase/supabase-js';
import { DISPLAY_UNITS_PER_CREDIT } from '$lib/components/credit-amount-format';
import {
  PurchaseKind,
  creditsUsedFrom,
  refundEligibility,
  type LedgerGrant,
  type RefundEligibility
} from '$lib/billing/refund-policy';

type LedgerRow = {
  id: string;
  kind: 'grant' | 'debit';
  source: string;
  amount: number;
  created_at: string;
  expires_at: string | null;
  stripe_checkout_id: string | null;
  stripe_invoice_id: string | null;
};

export type PaymentRef = { checkoutId: string | null; invoiceId: string | null };
export type ProcessingFeeOf = (payment: PaymentRef) => Promise<number>;

const SUBSCRIPTION = 'subscription_renewal';
const PAID_SOURCES = new Set([SUBSCRIPTION, 'one_time_purchase']);

const toGrant = (row: LedgerRow): LedgerGrant => ({
  id: row.id,
  amount: row.amount,
  createdAt: new Date(row.created_at),
  expiresAt: row.expires_at ? new Date(row.expires_at) : null
});

const byNewest = (a: LedgerRow, b: LedgerRow) => Date.parse(b.created_at) - Date.parse(a.created_at);

function kindOf(latest: LedgerRow, paid: LedgerRow[]): PurchaseKind {
  if (latest.source !== SUBSCRIPTION) {
    return PurchaseKind.TopUp;
  }

  const earlierSubscription = paid.some(
    (row) => row.source === SUBSCRIPTION && Date.parse(row.created_at) < Date.parse(latest.created_at)
  );
  return earlierSubscription ? PurchaseKind.Renewal : PurchaseKind.FirstSubscription;
}

export async function latestRefund(
  db: SupabaseClient,
  orgId: string,
  now: Date,
  feeOf: ProcessingFeeOf
): Promise<RefundEligibility | null> {
  const { data } = await db
    .from('credit_ledger')
    .select('id, kind, source, amount, created_at, expires_at, stripe_checkout_id, stripe_invoice_id')
    .eq('org_id', orgId);
  const rows = (data ?? []) as LedgerRow[];

  const grants = rows.filter((row) => row.kind === 'grant');
  const paid = grants.filter((row) => PAID_SOURCES.has(row.source)).sort(byNewest);
  const latest = paid[0];
  if (!latest) {
    return null;
  }

  const totalDebits = rows.filter((row) => row.kind === 'debit').reduce((sum, row) => sum + row.amount, 0);
  const usedUnits = creditsUsedFrom(grants.map(toGrant), totalDebits, latest.id);
  const credits = latest.amount / DISPLAY_UNITS_PER_CREDIT;

  return refundEligibility({
    purchase: {
      pricePaid: credits,
      creditsGranted: credits,
      processingFee: await feeOf({ checkoutId: latest.stripe_checkout_id ?? null, invoiceId: latest.stripe_invoice_id ?? null }),
      purchasedAt: new Date(latest.created_at)
    },
    creditsUsedFromPurchase: usedUnits / DISPLAY_UNITS_PER_CREDIT,
    now,
    kind: kindOf(latest, paid)
  });
}
