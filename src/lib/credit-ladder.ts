export const CREDITS_PER_USD_GRANT = 100;

export const PLAN_CURRENCY = 'eur';

export type Plan = { price: number; credits: number; lookupKey: string };

export type TopUp = { price: number; credits: number };

const monthlyLookupKey = (price: number) => `feega_monthly_${price}`;

export const PLAN: Plan = { price: 9, credits: 500, lookupKey: monthlyLookupKey(9) };

export const FREE_EDITOR_SEATS = 1;

export const TOP_UPS: readonly TopUp[] = [10, 20, 50].map((price) => ({ price, credits: price * CREDITS_PER_USD_GRANT }));

export const RETIRED_PLANS: readonly Plan[] = [8, 16, 32, 64, 128, 256].map((price) => ({
  price,
  credits: price * CREDITS_PER_USD_GRANT,
  lookupKey: monthlyLookupKey(price)
}));

export const topUpFor = (credits: number): TopUp | undefined => TOP_UPS.find((topUp) => topUp.credits === credits);

export const planForLookupKey = (lookupKey: string | null | undefined): Plan | undefined =>
  [PLAN, ...RETIRED_PLANS].find((plan) => plan.lookupKey === lookupKey);

export const FREE_ORGS_PER_USER = 2;
