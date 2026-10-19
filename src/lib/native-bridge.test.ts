import { describe, expect, it, vi } from 'vitest';
import { nativeBridge } from './native-bridge';

const ORG = '7d0c6a2e-4b1f-4a8e-9a43-2f3f1c9b5e10';
const KEY = 'appl_public';

function capacitor(plugins: Record<string, unknown>) {
  return { Capacitor: { isNativePlatform: () => true, Plugins: plugins } };
}

describe('nativeBridge', () => {
  it('is absent in a browser, and in a Capacitor web build that is not native', () => {
    expect(nativeBridge({}, { revenueCatKey: KEY })).toBeNull();
    expect(nativeBridge({ Capacitor: { isNativePlatform: () => false, Plugins: {} } }, { revenueCatKey: KEY })).toBeNull();
  });

  it('in Tauri asks the shell plugins and offers no share sheet or haptics', async () => {
    const invoke = vi.fn(async () => ({ identityToken: 'jwt' }));
    const bridge = nativeBridge({ __TAURI_INTERNALS__: { invoke } }, { revenueCatKey: KEY });

    expect(await bridge?.appleAuthorize?.('hashed')).toEqual({ identityToken: 'jwt' });
    expect(invoke).toHaveBeenCalledWith('plugin:apple-sign-in|authorize', { nonce: 'hashed' });
    expect(bridge?.share).toBeNull();
    expect(bridge?.haptic).toBeNull();
  });

  it('in Tauri buys and restores for the org through the shell store plugin', async () => {
    const invoke = vi.fn(async () => ({ purchased: true }));
    const store = nativeBridge({ __TAURI_INTERNALS__: { invoke } }, { revenueCatKey: '' })?.store;

    expect(await store?.purchase(ORG, 'feega_pack_32')).toEqual({ purchased: true });
    await store?.restore(ORG);

    expect(invoke).toHaveBeenCalledWith('plugin:feega-iap|purchase', { appUserId: ORG, productId: 'feega_pack_32' });
    expect(invoke).toHaveBeenCalledWith('plugin:feega-iap|restore', { appUserId: ORG });
  });

  it('in Capacitor signs in with Apple through FeegaAppleSignIn, only when the shell registered it', async () => {
    const authorize = vi.fn(async () => ({ identityToken: 'jwt' }));

    expect(nativeBridge(capacitor({ FeegaAppleSignIn: { authorize } }), { revenueCatKey: KEY })?.appleAuthorize).not.toBeNull();
    expect(await nativeBridge(capacitor({ FeegaAppleSignIn: { authorize } }), { revenueCatKey: KEY })?.appleAuthorize?.('hashed')).toEqual({ identityToken: 'jwt' });
    expect(authorize).toHaveBeenCalledWith({ nonce: 'hashed' });
    expect(nativeBridge(capacitor({}), { revenueCatKey: KEY })?.appleAuthorize).toBeNull();
  });

  it('in Capacitor buys through RevenueCat with the org as app user', async () => {
    const product = { identifier: 'feega_pack_32' };
    const Purchases = {
      configure: vi.fn(async () => undefined),
      logIn: vi.fn(async () => ({})),
      getProducts: vi.fn(async () => ({ products: [product] })),
      purchaseStoreProduct: vi.fn(async () => ({ customerInfo: {} })),
      restorePurchases: vi.fn(async () => ({ customerInfo: {} }))
    };
    const store = nativeBridge(capacitor({ Purchases }), { revenueCatKey: KEY })?.store;

    expect(await store?.purchase(ORG, 'feega_pack_32')).toEqual({ purchased: true });
    await store?.restore(ORG);

    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: KEY, appUserID: ORG });
    expect(Purchases.getProducts).toHaveBeenCalledWith({ productIdentifiers: ['feega_pack_32'] });
    expect(Purchases.purchaseStoreProduct).toHaveBeenCalledWith({ product });
    expect(Purchases.logIn).toHaveBeenCalledWith({ appUserID: ORG });
  });

  it('a cancelled purchase is not a failure and buys nothing', async () => {
    const Purchases = {
      configure: vi.fn(async () => undefined),
      logIn: vi.fn(async () => ({})),
      getProducts: vi.fn(async () => ({ products: [{ identifier: 'p' }] })),
      purchaseStoreProduct: vi.fn(async () => Promise.reject({ code: '1', userCancelled: true })),
      restorePurchases: vi.fn()
    };

    expect(await nativeBridge(capacitor({ Purchases }), { revenueCatKey: KEY })?.store?.purchase(ORG, 'p')).toEqual({ purchased: false });
  });

  it('without a RevenueCat key there is no store', () => {
    expect(nativeBridge(capacitor({ Purchases: {} }), { revenueCatKey: '' })?.store).toBeNull();
  });

  it('without a RevenueCat key a debug shell buys straight from StoreKit, for the org', async () => {
    const FeegaStoreKit = {
      purchase: vi.fn(async () => ({ purchased: true })),
      restore: vi.fn(async () => ({ purchased: true }))
    };
    const store = nativeBridge(capacitor({ Purchases: {}, FeegaStoreKit }), { revenueCatKey: '' })?.store;

    expect(await store?.purchase(ORG, 'feega_pack_8')).toEqual({ purchased: true });
    expect(await store?.restore(ORG)).toEqual({ purchased: true });
    expect(FeegaStoreKit.purchase).toHaveBeenCalledWith({ appUserId: ORG, productId: 'feega_pack_8' });
    expect(FeegaStoreKit.restore).toHaveBeenCalledWith({ appUserId: ORG });
  });

  it('with a RevenueCat key RevenueCat wins over local StoreKit', async () => {
    const FeegaStoreKit = { purchase: vi.fn(), restore: vi.fn() };
    const Purchases = {
      configure: vi.fn(async () => undefined),
      logIn: vi.fn(async () => ({})),
      getProducts: vi.fn(async () => ({ products: [{ identifier: 'p' }] })),
      purchaseStoreProduct: vi.fn(async () => ({})),
      restorePurchases: vi.fn()
    };

    await nativeBridge(capacitor({ Purchases, FeegaStoreKit }), { revenueCatKey: KEY })?.store?.purchase(ORG, 'p');

    expect(Purchases.purchaseStoreProduct).toHaveBeenCalled();
    expect(FeegaStoreKit.purchase).not.toHaveBeenCalled();
  });

  it('in Capacitor shares with the system sheet and taps a light haptic', async () => {
    const Share = { share: vi.fn(async () => ({})) };
    const Haptics = { impact: vi.fn(async () => undefined) };
    const bridge = nativeBridge(capacitor({ Share, Haptics }), { revenueCatKey: KEY });

    await bridge?.share?.({ title: 'Launch', url: 'https://x.test/v.mp4' });
    bridge?.haptic?.();

    expect(Share.share).toHaveBeenCalledWith({ title: 'Launch', url: 'https://x.test/v.mp4' });
    expect(Haptics.impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });
});
