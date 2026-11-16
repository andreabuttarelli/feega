import { createAdminClient } from '$lib/server/supabase-admin';

export type Hold = { amount: number; note: string };

const STALE_HOLD_AGE = '1 day';

async function rpc<T>(name: 'credit_hold' | 'credit_release' | 'credit_release_stale', args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createAdminClient().rpc(name, args as never);
  if (error) {
    throw new Error(`${name} failed: ${error.message}`);
  }
  return data as T;
}

export async function holdCredits(orgId: string, holds: Hold[]): Promise<boolean> {
  return rpc<boolean>('credit_hold', { _org_id: orgId, _keys: holds.map((h) => h.note), _amounts: holds.map((h) => h.amount) });
}

export async function refundHold(orgId: string, note: string): Promise<number> {
  return Number(await rpc<number>('credit_release', { _org_id: orgId, _key: note }));
}

export async function releaseStaleHolds(): Promise<number> {
  return Number(await rpc<number>('credit_release_stale', { _older_than: STALE_HOLD_AGE }));
}
