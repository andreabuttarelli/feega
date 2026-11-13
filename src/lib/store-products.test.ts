import { describe, expect, it } from 'vitest';
import { STORE_PRODUCTS, storeProduct, StoreProductKind } from './store-products';

describe('store products', () => {
  it('sells one plan and three packs', () => {
    expect(STORE_PRODUCTS.map((p) => p.id)).toEqual(['feega_monthly_9', 'feega_pack_10', 'feega_pack_20', 'feega_pack_50']);
  });

  it('still resolves a retired product, so its renewal or refund is never dropped', () => {
    expect(storeProduct('feega_monthly_16')).toEqual({ id: 'feega_monthly_16', kind: StoreProductKind.Subscription, credits: 1600 });
    expect(storeProduct('feega_pack_32')).toEqual({ id: 'feega_pack_32', kind: StoreProductKind.CreditPack, credits: 3200 });
    expect(storeProduct('feega_monthly_7')).toBeUndefined();
  });
});
