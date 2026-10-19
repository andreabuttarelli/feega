export const STORE_PLUGIN = 'feega-iap';

export type StorePurchase = { purchased: boolean };

export type StoreBridge = {
  purchase(appUserId: string, productId: string): Promise<StorePurchase>;
  restore(appUserId: string): Promise<StorePurchase>;
};

type Invoke = (command: string, args: Record<string, unknown>) => Promise<unknown>;
type ShellWindow = { __TAURI_INTERNALS__?: { invoke?: Invoke } };

export function storeBridge(win: ShellWindow = globalThis as ShellWindow): StoreBridge | null {
  const invoke = win.__TAURI_INTERNALS__?.invoke;
  if (!invoke) {
    return null;
  }

  const call = (command: string, args: Record<string, unknown>) =>
    invoke(`plugin:${STORE_PLUGIN}|${command}`, args) as Promise<StorePurchase>;

  return {
    purchase: (appUserId, productId) => call('purchase', { appUserId, productId }),
    restore: (appUserId) => call('restore', { appUserId })
  };
}
