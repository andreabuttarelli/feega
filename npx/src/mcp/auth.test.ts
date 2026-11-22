import { describe, expect, it } from 'vitest';
import { memoryAccountStore, type Account } from '../../../inspect/src/host/account';
import { bearerOf } from './auth';

const NOW_SECONDS = 1_000;
const account = (expiresAt: number): Account => ({ access_token: 'jwt', refresh_token: 'r', expires_at: expiresAt, user: { id: 'u', email: 'a@b.c' } });

describe('mcp bearer token', () => {
  it('prefers a feega_ api key from the environment', async () => {
    const store = memoryAccountStore();
    await store.write(account(NOW_SECONDS + 60));

    expect(await bearerOf({ env: { FEEGA_API_KEY: 'feega_abc' }, store, nowSeconds: () => NOW_SECONDS })).toBe('feega_abc');
  });

  it('ignores a key that is not a feega_ key', async () => {
    expect(await bearerOf({ env: { FEEGA_API_KEY: 'sk-other' }, store: memoryAccountStore(), nowSeconds: () => NOW_SECONDS })).toBeNull();
  });

  it('uses the signed-in account of the editor and the cli', async () => {
    const store = memoryAccountStore();
    await store.write(account(NOW_SECONDS + 60));

    expect(await bearerOf({ env: {}, store, nowSeconds: () => NOW_SECONDS })).toBe('jwt');
  });

  it('treats an expired account as signed out', async () => {
    const store = memoryAccountStore();
    await store.write(account(NOW_SECONDS - 1));

    expect(await bearerOf({ env: {}, store, nowSeconds: () => NOW_SECONDS })).toBeNull();
  });

  it('is signed out with nothing stored', async () => {
    expect(await bearerOf({ env: {}, store: memoryAccountStore(), nowSeconds: () => NOW_SECONDS })).toBeNull();
  });
});
