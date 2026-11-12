export const AI_MARKUP = 0.2;

export const MARGIN_FLOOR = 0.15;

export const CREDITS_PER_USD_SUBSCRIPTION_LIST = 100 * (1 + AI_MARKUP); // 120

export const CREDITS_PER_USD_GRANT = 100;

export const MULTIPLIER_FLOOR = 4;
export const CHAT_MULTIPLIER = 1.2;

export const PLAN_CURRENCY = 'eur';

export type Plan = { price: number; credits: number; lookupKey: string };

export type TopUp = { price: number; credits: number };

const monthlyLookupKey = (price: number) => `feega_monthly_${price}`;

export const PLAN: Plan = { price: 9, credits: 500, lookupKey: monthlyLookupKey(9) };

export const FREE_EDITOR_SEATS = 1;

export const TOP_UPS: readonly TopUp[] = [10, 20, 50].map((price) => ({ price, credits: price * CREDITS_PER_USD_GRANT }));

const RETIRED_PLANS: readonly Plan[] = [8, 16, 32, 64, 128, 256].map((price) => ({
  price,
  credits: price * CREDITS_PER_USD_GRANT,
  lookupKey: monthlyLookupKey(price)
}));

export const topUpFor = (credits: number): TopUp | undefined => TOP_UPS.find((topUp) => topUp.credits === credits);

export const planForLookupKey = (lookupKey: string | null | undefined): Plan | undefined =>
  [PLAN, ...RETIRED_PLANS].find((plan) => plan.lookupKey === lookupKey);

export function billedCreditsFor(costUsd: number, multiplier = 1 + AI_MARKUP): number {
  return Math.round(costUsd * multiplier * CREDITS_PER_USD_GRANT);
}

export function marginForRung(price: number, credits: number): number {
  const cost = credits / CREDITS_PER_USD_SUBSCRIPTION_LIST;
  return (price - cost) / price;
}

export const ZERNIO_COST_PER_ACCOUNT_USD_PLACEHOLDER = 7;
export const ACCOUNT_SEAT_USD = 11;
export const ACCOUNT_SEAT_CREDITS = ACCOUNT_SEAT_USD * CREDITS_PER_USD_SUBSCRIPTION_LIST; // 1320

export const FREE_ORGS_PER_USER = 2;
