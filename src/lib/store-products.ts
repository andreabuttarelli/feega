import { CREDIT_LADDER } from '$lib/credit-ladder';

export enum StoreProductKind {
  Subscription = 'subscription',
  CreditPack = 'credit_pack'
}

export type StoreProduct = { id: string; kind: StoreProductKind; credits: number };

export const packProductId = (price: number): string => `feega_pack_${price}`;

export const STORE_PRODUCTS: readonly StoreProduct[] = [
  ...CREDIT_LADDER.map((rung) => ({ id: rung.lookupKey, kind: StoreProductKind.Subscription, credits: rung.credits })),
  ...CREDIT_LADDER.map((rung) => ({ id: packProductId(rung.price), kind: StoreProductKind.CreditPack, credits: rung.credits }))
];

export const storeProduct = (id: string | null | undefined): StoreProduct | undefined =>
  STORE_PRODUCTS.find((product) => product.id === id);
