import type { Db } from '$lib/server/db/client';
import { can, OrgAction, type OrgRole } from '$lib/org-roles';
import type { AllowlistMedium } from './allowlist';

export const ALLOWLIST_MEDIA_LIST = ['image', 'video', 'model3d'] as const;

export type Allowlists = Record<AllowlistMedium, string[]>;

type Row = { medium: AllowlistMedium; model_id: string };

type Untyped = {
  from: (table: string) => any;
};

const untyped = (db: Db) => db as unknown as Untyped;

export async function isOrgAdmin(db: Db, orgId: string, userId: string): Promise<boolean> {
  const { data } = await untyped(db).from('orgs_members').select('role').eq('org_id', orgId).eq('user_id', userId).maybeSingle();
  const role = (data as { role?: OrgRole } | null)?.role;
  return role ? can(role, OrgAction.ManageMembers) : false;
}

export async function readAllowlist(db: Db, orgId: string): Promise<Allowlists | null> {
  const { data, error } = await untyped(db).from('org_model_allowlist').select('medium, model_id').eq('org_id', orgId);
  if (error) {
    return null;
  }

  const lists: Allowlists = { image: [], video: [], model3d: [] };
  for (const row of (data ?? []) as Row[]) {
    lists[row.medium]?.push(row.model_id);
  }
  return lists;
}

export async function setAllowlist(db: Db, scope: { orgId: string; medium: AllowlistMedium; modelIds: string[] }): Promise<boolean> {
  const removed = await untyped(db).from('org_model_allowlist').delete().eq('org_id', scope.orgId).eq('medium', scope.medium);
  if (removed.error) {
    return false;
  }

  const ids = [...new Set(scope.modelIds)];
  if (!ids.length) {
    return true;
  }

  const added = await untyped(db)
    .from('org_model_allowlist')
    .insert(ids.map((model_id) => ({ org_id: scope.orgId, medium: scope.medium, model_id })));
  return !added.error;
}
