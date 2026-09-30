import { describe, expect, it } from 'vitest';
import {
  PurchaseKind,
  RefundReason,
  creditsUsedFrom,
  refundEligibility,
  type LedgerGrant
} from './refund-policy';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const boughtAt = new Date('2026-09-01T10:00:00Z');
const at = (ms: number) => new Date(boughtAt.getTime() + ms);
const purchase = { pricePaid: 32, creditsGranted: 32, processingFee: 0, purchasedAt: boughtAt };

describe('refundEligibility', () => {
  it('refunds a first purchase in full when nothing was used', () => {
    const result = refundEligibility({
      purchase,
      creditsUsedFromPurchase: 0,
      now: at(DAY_MS),
      kind: PurchaseKind.FirstSubscription
    });

    expect(result).toEqual({
      eligible: true,
      amount: 32,
      reason: RefundReason.WithinWindow,
      until: at(14 * DAY_MS),
      maxCreditsUsable: 3.2
    });
  });

  it('deducts the value of the credits used, up to 10%', () => {
    const result = refundEligibility({
      purchase,
      creditsUsedFromPurchase: 3.2,
      now: at(DAY_MS),
      kind: PurchaseKind.TopUp
    });

    expect(result.eligible).toBe(true);
    expect(result.amount).toBe(28.8);
  });

  it('refuses a purchase with more than 10% of its credits used', () => {
    const result = refundEligibility({
      purchase,
      creditsUsedFromPurchase: 3.21,
      now: at(DAY_MS),
      kind: PurchaseKind.TopUp
    });

    expect(result).toMatchObject({ eligible: false, amount: 0, reason: RefundReason.UsageAboveThreshold });
  });

  it('refuses a first purchase after 14 days', () => {
    const result = refundEligibility({
      purchase,
      creditsUsedFromPurchase: 0,
      now: at(14 * DAY_MS + 1),
      kind: PurchaseKind.FirstSubscription
    });

    expect(result).toMatchObject({ eligible: false, reason: RefundReason.WindowClosed });
  });

  it('refunds a renewal in full within 48 hours when untouched', () => {
    const result = refundEligibility({
      purchase,
      creditsUsedFromPurchase: 0,
      now: at(47 * HOUR_MS),
      kind: PurchaseKind.Renewal
    });

    expect(result).toEqual({
      eligible: true,
      amount: 32,
      reason: RefundReason.WithinWindow,
      until: at(48 * HOUR_MS),
      maxCreditsUsable: 0
    });
  });

  it('refuses a renewal once a single credit of it was used', () => {
    const result = refundEligibility({
      purchase,
      creditsUsedFromPurchase: 1,
      now: at(HOUR_MS),
      kind: PurchaseKind.Renewal
    });

    expect(result).toMatchObject({ eligible: false, reason: RefundReason.UsageAboveThreshold });
  });

  it('caps usage at 5 credits on a large plan, where 10% would be more', () => {
    const large = { ...purchase, pricePaid: 256, creditsGranted: 256 };
    const within = refundEligibility({ purchase: large, creditsUsedFromPurchase: 5, now: at(DAY_MS), kind: PurchaseKind.FirstSubscription });
    const above = refundEligibility({ purchase: large, creditsUsedFromPurchase: 5.01, now: at(DAY_MS), kind: PurchaseKind.FirstSubscription });

    expect(within).toMatchObject({ eligible: true, amount: 251, maxCreditsUsable: 5 });
    expect(above).toMatchObject({ eligible: false, reason: RefundReason.UsageAboveThreshold });
  });

  it('keeps 10% as the limit on a small plan, where it is under 5 credits', () => {
    const small = { ...purchase, pricePaid: 8, creditsGranted: 8 };
    const above = refundEligibility({ purchase: small, creditsUsedFromPurchase: 0.81, now: at(DAY_MS), kind: PurchaseKind.TopUp });

    expect(above).toMatchObject({ eligible: false, maxCreditsUsable: 0.8 });
  });

  it('keeps the payment processing fee, which the payment provider does not return', () => {
    const result = refundEligibility({
      purchase: { ...purchase, processingFee: 0.7 },
      creditsUsedFromPurchase: 1,
      now: at(DAY_MS),
      kind: PurchaseKind.TopUp
    });

    expect(result.amount).toBe(30.3);
  });

  it('never refunds welcome credits', () => {
    const result = refundEligibility({
      purchase: { ...purchase, pricePaid: 0 },
      creditsUsedFromPurchase: 0,
      now: at(HOUR_MS),
      kind: PurchaseKind.Welcome
    });

    expect(result).toMatchObject({ eligible: false, amount: 0, reason: RefundReason.NeverRefundable, until: null, maxCreditsUsable: 0 });
  });
});

describe('creditsUsedFrom', () => {
  const grant = (id: string, amount: number, createdAt: string, expiresAt: string | null): LedgerGrant => ({
    id,
    amount,
    createdAt: new Date(createdAt),
    expiresAt: expiresAt ? new Date(expiresAt) : null
  });

  const welcome = grant('w', 500, '2026-09-01', '2026-09-15');
  const plan = grant('p', 800, '2026-09-02', '2026-10-02');
  const topUp = grant('t', 1600, '2026-09-03', null);
  const grants = [topUp, plan, welcome];

  it('spends expiring grants first, soonest expiry first', () => {
    expect(creditsUsedFrom(grants, 400, 'w')).toBe(400);
    expect(creditsUsedFrom(grants, 400, 'p')).toBe(0);
  });

  it('reaches a non-expiring top-up only after every expiring grant', () => {
    expect(creditsUsedFrom(grants, 1500, 'p')).toBe(800);
    expect(creditsUsedFrom(grants, 1500, 't')).toBe(200);
  });

  it('is zero for an unknown grant', () => {
    expect(creditsUsedFrom(grants, 1500, 'missing')).toBe(0);
  });
});
