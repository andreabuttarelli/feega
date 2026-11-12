import { PLAN, RETIRED_PLANS, TOP_UPS } from '$lib/credit-ladder';

export enum StoreProductKind {
  Subscription = 'subscription',
  CreditPack = 'credit_pack'
}

export type StoreProduct = { id: string; kind: StoreProductKind; credits: number };

export const packProductId = (price: number): string => `feega_pack_${price}`;

export const STORE_PRODUCTS: readonly StoreProduct[] = [
  { id: PLAN.lookupKey, kind: StoreProductKind.Subscription, credits: PLAN.credits },
  ...TOP_UPS.map((topUp) => ({ id: packProductId(topUp.price), kind: StoreProductKind.CreditPack, credits: topUp.credits }))
];

const RETIRED_STORE_PRODUCTS: readonly StoreProduct[] = RETIRED_PLANS.flatMap((plan) => [
  { id: plan.lookupKey, kind: StoreProductKind.Subscription, credits: plan.credits },
  { id: packProductId(plan.price), kind: StoreProductKind.CreditPack, credits: plan.credits }
]);

export const storeProduct = (id: string | null | undefined): StoreProduct | undefined =>
  [...STORE_PRODUCTS, ...RETIRED_STORE_PRODUCTS].find((product) => product.id === id);
