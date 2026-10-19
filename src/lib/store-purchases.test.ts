import { describe, expect, it, vi } from 'vitest';
import { STORE_PLUGIN, storeBridge } from './store-purchases';

const ORG = '7d0c6a2e-4b1f-4a8e-9a43-2f3f1c9b5e10';

describe('storeBridge', () => {
  it('is absent outside the native shell, so the web never reaches a store', () => {
    expect(storeBridge({})).toBeNull();
  });

  it('buys a product for the org through the shell plugin', async () => {
    const invoke = vi.fn(async () => ({ purchased: true }));
    const bridge = storeBridge({ __TAURI_INTERNALS__: { invoke } });

    expect(await bridge?.purchase(ORG, 'feega_pack_32')).toEqual({ purchased: true });
    expect(invoke).toHaveBeenCalledWith(`plugin:${STORE_PLUGIN}|purchase`, { appUserId: ORG, productId: 'feega_pack_32' });
  });

  it('restores purchases for the org', async () => {
    const invoke = vi.fn(async () => ({ purchased: false }));
    const bridge = storeBridge({ __TAURI_INTERNALS__: { invoke } });

    await bridge?.restore(ORG);

    expect(invoke).toHaveBeenCalledWith(`plugin:${STORE_PLUGIN}|restore`, { appUserId: ORG });
  });
});
