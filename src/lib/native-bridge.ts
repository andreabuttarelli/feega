export const STORE_PLUGIN = 'feega-iap';
export const APPLE_AUTHORIZE_COMMAND = 'plugin:apple-sign-in|authorize';

export type StorePurchase = { purchased: boolean };

export type StoreBridge = {
  purchase(appUserId: string, productId: string): Promise<StorePurchase>;
  restore(appUserId: string): Promise<StorePurchase>;
};

export type AppleAuthorize = (nonce: string) => Promise<{ identityToken: string }>;
export type ShareItem = { title?: string; url: string };

export type NativeBridge = {
  appleAuthorize: AppleAuthorize | null;
  store: StoreBridge | null;
  share: ((item: ShareItem) => Promise<void>) | null;
  haptic: (() => void) | null;
};

export type NativeKeys = { revenueCatKey: string };

type Invoke = (command: string, args: Record<string, unknown>) => Promise<unknown>;
type Plugin = Record<string, (args?: Record<string, unknown>) => Promise<unknown>>;
type ShellWindow = {
  __TAURI_INTERNALS__?: { invoke?: Invoke };
  Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> };
};

const NOT_PURCHASED: StorePurchase = { purchased: false };
const PURCHASED: StorePurchase = { purchased: true };

function tauriBridge(invoke: Invoke): NativeBridge {
  const store = (command: string, args: Record<string, unknown>) => invoke(`plugin:${STORE_PLUGIN}|${command}`, args) as Promise<StorePurchase>;
  return {
    appleAuthorize: (nonce) => invoke(APPLE_AUTHORIZE_COMMAND, { nonce }) as Promise<{ identityToken: string }>,
    store: {
      purchase: (appUserId, productId) => store('purchase', { appUserId, productId }),
      restore: (appUserId) => store('restore', { appUserId })
    },
    share: null,
    haptic: null
  };
}

function revenueCatStore(purchases: Plugin, apiKey: string): StoreBridge {
  let configured: Promise<unknown> | null = null;
  const ready = async (appUserID: string) => {
    configured ??= purchases.configure({ apiKey, appUserID });
    await configured;
    await purchases.logIn({ appUserID });
  };

  return {
    purchase: async (appUserId, productId) => {
      await ready(appUserId);
      const { products } = (await purchases.getProducts({ productIdentifiers: [productId] })) as { products: unknown[] };
      if (!products[0]) {
        throw new Error(`unknown store product ${productId}`);
      }
      try {
        await purchases.purchaseStoreProduct({ product: products[0] });
        return PURCHASED;
      } catch (e) {
        if ((e as { userCancelled?: boolean }).userCancelled) {
          return NOT_PURCHASED;
        }
        throw e;
      }
    },
    restore: async (appUserId) => {
      await ready(appUserId);
      await purchases.restorePurchases();
      return PURCHASED;
    }
  };
}

function capacitorBridge(plugins: Record<string, unknown>, keys: NativeKeys): NativeBridge {
  const plugin = (name: string) => (plugins[name] as Plugin | undefined) ?? null;
  const apple = plugin('FeegaAppleSignIn');
  const purchases = plugin('Purchases');
  const share = plugin('Share');
  const haptics = plugin('Haptics');

  return {
    appleAuthorize: apple ? (nonce) => apple.authorize({ nonce }) as Promise<{ identityToken: string }> : null,
    store: purchases && keys.revenueCatKey ? revenueCatStore(purchases, keys.revenueCatKey) : null,
    share: share ? async (item) => void (await share.share(item)) : null,
    haptic: haptics ? () => void haptics.impact({ style: 'LIGHT' }).catch(() => {}) : null
  };
}

export function nativeBridge(win: unknown, keys: NativeKeys): NativeBridge | null {
  const shell = win as ShellWindow;
  const invoke = shell.__TAURI_INTERNALS__?.invoke;
  if (invoke) {
    return tauriBridge(invoke);
  }
  if (shell.Capacitor?.isNativePlatform?.()) {
    return capacitorBridge(shell.Capacitor.Plugins ?? {}, keys);
  }
  return null;
}
