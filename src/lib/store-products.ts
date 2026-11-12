import { PLAN, TOP_UPS } from '$lib/credit-ladder';

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

export const storeProduct = (id: string | null | undefined): StoreProduct | undefined =>
  STORE_PRODUCTS.find((product) => product.id === id);
