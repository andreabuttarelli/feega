import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { accessToken, type Access } from './access';
import { CloudProvider, freshAccess, labelOf, revokeAccess, type Credentials } from './cloud';
import { disconnect } from './disconnect';
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

export function disconnectCloud(db: Db, userId: string, provider: CloudProvider) {
  const store = cloudTokenStore(db, userId);
  return disconnect(provider, { read: store.read, remove: store.remove, revoke: (p, token) => revokeAccess(p, token) });
}

export type CloudStatus = { provider: CloudProvider; label: string; connected: boolean; configured: boolean };

export async function cloudStatuses(db: Db, userId: string): Promise<CloudStatus[]> {
  const store = cloudTokenStore(db, userId);
  return Promise.all(
    Object.values(CloudProvider).map(async (provider) => ({
      provider,
      label: labelOf(provider),
      connected: Boolean(await store.read(provider).catch(() => null)),
      configured: credentialsOf(provider) !== null
    }))
  );
}
