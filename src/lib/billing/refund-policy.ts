export enum PurchaseKind {
  FirstSubscription = 'first_subscription',
  Renewal = 'renewal',
  TopUp = 'top_up',
  Welcome = 'welcome'
}

export enum RefundReason {
  WithinWindow = 'within_window',
  WindowClosed = 'window_closed',
  UsageAboveThreshold = 'usage_above_threshold',
  NeverRefundable = 'never_refundable'
}

export type Purchase = {
  pricePaid: number;
  creditsGranted: number;
  processingFee: number;
  purchasedAt: Date;
};

export type RefundEligibility = {
  eligible: boolean;
  amount: number;
  reason: RefundReason;
  until: Date | null;
  maxCreditsUsable: number;
};

export type LedgerGrant = {
  id: string;
  amount: number;
  createdAt: Date;
  expiresAt: Date | null;
};

type RefundRule = { windowMs: number; maxUsedShare: number; maxUsedCredits: number } | null;

const HOUR_MS = 3_600_000;
const WITHDRAWAL_WINDOW_MS = 14 * 24 * HOUR_MS;
const RENEWAL_WINDOW_MS = 48 * HOUR_MS;
const WITHDRAWAL_RULE = { windowMs: WITHDRAWAL_WINDOW_MS, maxUsedShare: 0.1, maxUsedCredits: 5 };

const RULES: Record<PurchaseKind, RefundRule> = {
  [PurchaseKind.FirstSubscription]: WITHDRAWAL_RULE,
  [PurchaseKind.TopUp]: WITHDRAWAL_RULE,
  [PurchaseKind.Renewal]: { windowMs: RENEWAL_WINDOW_MS, maxUsedShare: 0, maxUsedCredits: 0 },
  [PurchaseKind.Welcome]: null
};

const CENTS = 100;
const toCents = (euros: number) => Math.round(euros * CENTS) / CENTS;

export function refundEligibility(input: {
  purchase: Purchase;
  creditsUsedFromPurchase: number;
  now: Date;
  kind: PurchaseKind;
}): RefundEligibility {
  const rule = RULES[input.kind];
  if (!rule) {
    return { eligible: false, amount: 0, reason: RefundReason.NeverRefundable, until: null, maxCreditsUsable: 0 };
  }

  const { pricePaid, creditsGranted, processingFee, purchasedAt } = input.purchase;
  const used = input.creditsUsedFromPurchase;
  const until = new Date(purchasedAt.getTime() + rule.windowMs);
  const maxCreditsUsable = toCents(Math.min(creditsGranted * rule.maxUsedShare, rule.maxUsedCredits));
  const refused = (reason: RefundReason) => ({ eligible: false, amount: 0, reason, until, maxCreditsUsable });

  if (input.now > until) {
    return refused(RefundReason.WindowClosed);
  }
  if (used > maxCreditsUsable) {
    return refused(RefundReason.UsageAboveThreshold);
  }

  const amount = toCents(Math.max(pricePaid - used - processingFee, 0));
  return { eligible: true, amount, reason: RefundReason.WithinWindow, until, maxCreditsUsable };
}

const spendOrder = (a: LedgerGrant, b: LedgerGrant): number => {
  const aExpiry = a.expiresAt?.getTime() ?? Infinity;
  const bExpiry = b.expiresAt?.getTime() ?? Infinity;
  if (aExpiry !== bExpiry) {
    return aExpiry - bExpiry;
  }

  return a.createdAt.getTime() - b.createdAt.getTime();
};

export function creditsUsedFrom(grants: LedgerGrant[], totalDebits: number, grantId: string): number {
  let spentBefore = 0;
  for (const grant of [...grants].sort(spendOrder)) {
    if (grant.id === grantId) {
      return Math.min(Math.max(totalDebits - spentBefore, 0), grant.amount);
    }
    spentBefore += grant.amount;
  }

  return 0;
}
