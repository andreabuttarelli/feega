import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { accessToken, type Access } from './access';
import { CloudProvider, freshAccess, type Credentials } from './cloud';
import { cloudTokenStore } from './token-store';

const ENV_KEYS: Record<CloudProvider, { id: string; secret: string }> = {
  [CloudProvider.Drive]: { id: 'GOOGLE_DRIVE_CLIENT_ID', secret: 'GOOGLE_DRIVE_CLIENT_SECRET' },
  [CloudProvider.Dropbox]: { id: 'DROPBOX_CLIENT_ID', secret: 'DROPBOX_CLIENT_SECRET' }
};

export function credentialsOf(provider: CloudProvider): Credentials | null {
  const keys = ENV_KEYS[provider];
  const clientId = env[keys.id];
  const clientSecret = env[keys.secret];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const callbackUrl = (origin: string) => `${origin}/api/v1/cloud/callback`;

export function cloudAccess(db: Db, userId: string, provider: CloudProvider): Promise<Access> {
  const store = cloudTokenStore(db, userId);
  return accessToken(provider, {
    credentials: credentialsOf,
    read: store.read,
    save: store.save,
    refresh: (p, tokens, creds, now) => freshAccess(p, tokens, creds, fetch, now),
    now: Date.now
  });
}
