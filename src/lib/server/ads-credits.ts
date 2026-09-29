import { creditsForSpend, feeBreakdown } from '$lib/ads-fee';
import { logAiCall } from '$lib/server/ai-log';

// ── Ads metering ────────────────────────────────────────────────────────────────
// Running ads costs credits: the 12% management fee is charged against the same balance as AI
// generation. Two moments draw down:
//   launch      — approving a campaign pre-pays the fee on its first day of budget
//   continuation— every metrics sync charges the fee on ad spend that arrived since the last charge
//
// The ledger is `ai_calls` (provider 'ads', flatCostUsd), exactly like the non-LLM paid APIs, so
// getCreditsUsage() picks it up with no second accounting system. Charges are DELTA-based against
// external_ids.creditedSpend on the campaign, which makes a re-run (cron retry, page refresh,
// double click) charge zero instead of double.

/** Cumulative spend already billed for a campaign, from its external_ids blob. */
export function creditedSpend(externalIds: unknown): number {
  if (!externalIds || typeof externalIds !== 'object') return 0;
  const n = Number((externalIds as Record<string, unknown>).creditedSpend);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Fee owed (USD) on the spend a campaign has accrued beyond what we already billed. Returns 0
 * when spend went backwards (platform restatement) or rounds to nothing.
 */
export function feeUsdDue(totalSpend: number, alreadyCredited: number): number {
  const delta = (Number(totalSpend) || 0) - (Number(alreadyCredited) || 0);
  if (delta <= 0) return 0;
  return feeBreakdown(delta).fee;
}

/** Credits owed on the spend a campaign has accrued beyond what we already billed. */
export function creditsDue(totalSpend: number, alreadyCredited: number): number {
  const delta = (Number(totalSpend) || 0) - (Number(alreadyCredited) || 0);
  if (delta <= 0) return 0;
  return creditsForSpend(delta);
}

/**
 * Write the charge to the credits ledger. Fire-and-forget like every other logAiCall: metering
 * must never break a live campaign. withCreditExempt is deliberately NOT used — this row is the
 * whole point. `feeUsd` is the real provider-side cost (the management fee); `ai-log.ts` derives
 * `billed_credits` from it the same way it prices every other call, so this never carries its own
 * copy of the credit rate.
 */
export function chargeAdsCredits(opts: {
  brandId: string;
  feeUsd: number;
  label: 'ads.launch' | 'ads.spend';
  campaignId: string;
  platform?: string | null;
}): void {
  if (!opts.feeUsd || opts.feeUsd <= 0) return;
  logAiCall({
    label: opts.label,
    provider: 'ads',
    model: opts.platform ?? undefined,
    flatCostUsd: opts.feeUsd,
    ms: 0,
    ok: true,
    brandId: opts.brandId,
    context: opts.campaignId
  });
}


export { creditsForSpend };
