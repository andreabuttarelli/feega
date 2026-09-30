import type { SupabaseClient } from '@supabase/supabase-js';

export enum DeletionOutcome {
  Deleted = 'deleted',
  TransferRequired = 'transfer_required'
}

export type DeletionResult = { outcome: DeletionOutcome; orgIds: string[] };

export type Membership = { org_id: string; user_id: string; role: string };

export type AccountDeps = {
  db: SupabaseClient;
  removePrefix: (bucket: string, prefix: string) => Promise<void>;
  cancelAtPeriodEnd: (subscriptionId: string) => Promise<void>;
};

const OWNER = 'owner';
const USER_BUCKETS = ['brand-knowledge', 'media'] as const;
const ORG_BUCKETS = ['canvas-assets', 'influencers'] as const;
const STORAGE_ATTEMPTS = 3;

export function planDeletion(userId: string, members: Membership[]) {
  const myOrgs = [...new Set(members.filter((m) => m.user_id === userId).map((m) => m.org_id))];
  const others = (orgId: string) => members.filter((m) => m.org_id === orgId && m.user_id !== userId);
  const isOwner = (orgId: string) =>
    members.some((m) => m.org_id === orgId && m.user_id === userId && m.role === OWNER);

  const deleteOrgs = myOrgs.filter((orgId) => others(orgId).length === 0);
  const blockedOrgs = myOrgs.filter(
    (orgId) => isOwner(orgId) && others(orgId).length > 0 && !others(orgId).some((m) => m.role === OWNER)
  );
  return { deleteOrgs, blockedOrgs };
}

async function readMembers(db: SupabaseClient, userId: string): Promise<Membership[]> {
  const mine = await db.from('orgs_members').select('org_id').eq('user_id', userId);
  if (mine.error) {
    throw new Error(mine.error.message);
  }
  const orgIds = (mine.data ?? []).map((m: { org_id: string }) => m.org_id);
  if (orgIds.length === 0) {
    return [];
  }
  const all = await db.from('orgs_members').select('org_id, user_id, role').in('org_id', orgIds);
  if (all.error) {
    throw new Error(all.error.message);
  }
  return all.data ?? [];
}

async function cancelPlans(deps: AccountDeps, orgIds: string[]) {
  if (orgIds.length === 0) {
    return;
  }
  const { data, error } = await deps.db.from('orgs').select('id, stripe_subscription_id').in('id', orgIds);
  if (error) {
    throw new Error(error.message);
  }
  for (const org of data ?? []) {
    if (org.stripe_subscription_id) {
      await deps.cancelAtPeriodEnd(org.stripe_subscription_id);
    }
  }
}

async function removeWithRetry(deps: AccountDeps, bucket: string, prefix: string) {
  for (let attempt = 1; attempt <= STORAGE_ATTEMPTS; attempt++) {
    try {
      await deps.removePrefix(bucket, prefix);
      return;
    } catch (error) {
      if (attempt === STORAGE_ATTEMPTS) {
        console.error('account deletion: storage cleanup failed', bucket, error);
      }
    }
  }
}

export async function deleteAccountWith(deps: AccountDeps, userId: string): Promise<DeletionResult> {
  const plan = planDeletion(userId, await readMembers(deps.db, userId));
  if (plan.blockedOrgs.length > 0) {
    return { outcome: DeletionOutcome.TransferRequired, orgIds: plan.blockedOrgs };
  }

  await cancelPlans(deps, plan.deleteOrgs);

  const { data, error } = await deps.db.rpc('delete_account', { p_user: userId });
  if (error) {
    throw new Error(error.message);
  }
  const status = (data as { status?: string; org_ids?: string[] } | null)?.status;
  if (status === DeletionOutcome.TransferRequired) {
    return { outcome: DeletionOutcome.TransferRequired, orgIds: (data as { org_ids: string[] }).org_ids };
  }

  for (const bucket of USER_BUCKETS) {
    await removeWithRetry(deps, bucket, userId);
  }
  for (const orgId of plan.deleteOrgs) {
    for (const bucket of ORG_BUCKETS) {
      await removeWithRetry(deps, bucket, orgId);
    }
  }
  return { outcome: DeletionOutcome.Deleted, orgIds: plan.deleteOrgs };
}

export async function removeStoragePrefix(db: SupabaseClient, bucket: string, prefix: string): Promise<void> {
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) {
    throw new Error(error.message);
  }
  const files: string[] = [];
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      await removeStoragePrefix(db, bucket, path);
      continue;
    }
    files.push(path);
  }
  if (files.length === 0) {
    return;
  }
  const removed = await db.storage.from(bucket).remove(files);
  if (removed.error) {
    throw new Error(removed.error.message);
  }
  if (files.length === 1000) {
    await removeStoragePrefix(db, bucket, prefix);
  }
}
