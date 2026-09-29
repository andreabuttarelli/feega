import { billedCreditsFor } from '$lib/credit-ladder';

/** feega management fee on top of platform ad spend (model A: pass-through + markup). */
export const AD_MANAGEMENT_FEE_RATE = 0.12;

/**
 * The management fee, billed in AI credits instead of an invoice: launching a campaign and every
 * day it keeps spending draws down the same balance content generation uses. Same rate
 * `ai-log.ts` bills every other AI call at (`billedCreditsFor`, credit-ladder.ts) — the fee is a
 * provider cost to us like any other, not a separately-priced credit.
 *
 * ponytail: no FX — one unit of the ad account's currency counts as one dollar. EUR/USD drift is
 * ±10% on a 12% fee; add a rate lookup here if a brand ever runs a far-off currency.
 */
export function creditsForSpend(spend: number): number {
  return billedCreditsFor(feeBreakdown(spend).fee);
}

/**
 * Accept what a human (or the AI) actually types: "feega.app" is a URL to everyone except
 * `<input type="url">` and `new URL()`. Adds the scheme when it is missing rather than rejecting
 * the value. Returns '' for anything that still isn't a usable http(s) URL.
 */
export function normalizeUrl(raw: string | null | undefined): string {
  const v = String(raw ?? '').trim();
  if (!v) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

export function feeBreakdown(platformBudget: number): {
  platformBudget: number;
  fee: number;
  total: number;
  feeRate: number;
} {
  const amount = Math.max(0, Number(platformBudget) || 0);
  const fee = Math.round(amount * AD_MANAGEMENT_FEE_RATE * 100) / 100;
  return {
    platformBudget: amount,
    fee,
    total: Math.round((amount + fee) * 100) / 100,
    feeRate: AD_MANAGEMENT_FEE_RATE
  };
}
