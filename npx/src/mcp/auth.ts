import type { AccountStore } from '../../../inspect/src/host/account';

const API_KEY_VAR = 'FEEGA_API_KEY';
const API_KEY_PREFIX = 'feega_';

export type BearerSources = { env: NodeJS.ProcessEnv; store: AccountStore; nowSeconds?: () => number };

const secondsNow = () => Math.floor(Date.now() / 1000);

export async function bearerOf({ env, store, nowSeconds = secondsNow }: BearerSources): Promise<string | null> {
  const key = env[API_KEY_VAR];
  if (key?.startsWith(API_KEY_PREFIX)) {
    return key;
  }

  const account = await store.read();
  return account && account.expires_at > nowSeconds() ? account.access_token : null;
}
