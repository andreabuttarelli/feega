import type { Db } from '$lib/server/db/client';
import type { ProviderCaller } from '$lib/server/connections/account-links';
import type { AccountAccess, Scope } from '$lib/server/connections/account-access';
import { accountFor } from '$lib/server/connections/runtime';
import { CloudProvider, labelOf, toolkitOf } from './cloud';

export enum CloudRefusal {
  NotConfigured = 'not_configured',
  NotConnected = 'not_connected'
}

export const CLOUD_REFUSAL_STATUS: Record<CloudRefusal, number> = {
  [CloudRefusal.NotConfigured]: 501,
  [CloudRefusal.NotConnected]: 409
};

export type Access = { ok: true; call: ProviderCaller } | { ok: false; reason: CloudRefusal };

export const cloudAccount = (db: Db, scope: Scope, provider: CloudProvider): AccountAccess => accountFor(db, scope, toolkitOf(provider));

export async function cloudAccess(db: Db, scope: Scope, provider: CloudProvider): Promise<Access> {
  const account = cloudAccount(db, scope, provider);
  const call = await account.call();
  if (call) {
    return { ok: true, call };
  }
  return { ok: false, reason: (await account.status()).configured ? CloudRefusal.NotConnected : CloudRefusal.NotConfigured };
}

export type CloudStatus = { provider: CloudProvider; label: string; connected: boolean; configured: boolean };

export function cloudStatuses(db: Db, scope: Scope): Promise<CloudStatus[]> {
  return Promise.all(
    Object.values(CloudProvider).map(async (provider) => {
      const { connected, configured } = await cloudAccount(db, scope, provider).status().catch(() => ({ connected: false, configured: false }));
      return { provider, label: labelOf(provider), connected, configured };
    })
  );
}
