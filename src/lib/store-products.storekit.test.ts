import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STORE_PRODUCTS, StoreProductKind } from './store-products';

const STOREKIT_FILE = 'apps/mobile/ios/App/App/Products.storekit';
const MONTH = 'P1M';

type StoreKitConfig = {
  products: { productID: string; type: string }[];
  subscriptionGroups: { subscriptions: { productID: string; recurringSubscriptionPeriod: string; type: string }[] }[];
};

const config = JSON.parse(readFileSync(STOREKIT_FILE, 'utf8')) as StoreKitConfig;
const subscriptions = config.subscriptionGroups.flatMap((group) => group.subscriptions);
const idsOf = (kind: StoreProductKind) =>
  STORE_PRODUCTS.filter((p) => p.kind === kind)
    .map((p) => p.id)
    .sort();

describe('the local StoreKit configuration', () => {
  it('sells every credit pack as a consumable, and nothing else', () => {
    expect(config.products.map((p) => p.productID).sort()).toEqual(idsOf(StoreProductKind.CreditPack));
    expect(new Set(config.products.map((p) => p.type))).toEqual(new Set(['Consumable']));
  });

  it('sells every plan as a monthly auto-renewing subscription in one group', () => {
    expect(config.subscriptionGroups).toHaveLength(1);
    expect(subscriptions.map((s) => s.productID).sort()).toEqual(idsOf(StoreProductKind.Subscription));
    expect(new Set(subscriptions.map((s) => s.recurringSubscriptionPeriod))).toEqual(new Set([MONTH]));
    expect(new Set(subscriptions.map((s) => s.type))).toEqual(new Set(['RecurringSubscription']));
  });
});
