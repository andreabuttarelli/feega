import type { SupabaseClient } from '@supabase/supabase-js';
import { can, OrgAction } from '$lib/org-roles';
import { memberRole } from '$lib/server/repos/orgs';
import type { Db } from '$lib/server/db/client';

const WRITE_SCOPE = 'write';

export async function scopesOfHolder(
  admin: SupabaseClient,
  key: { org_id: string; user_id: string; scopes: string[] | null }
): Promise<string[] | null> {
  const role = await memberRole(admin as unknown as Db, { orgId: key.org_id, userId: key.user_id });
  if (!role) {
    return null;
  }

  const scopes = key.scopes ?? [];
  return can(role, OrgAction.ManageApiKeys) ? scopes : scopes.filter((scope) => scope !== WRITE_SCOPE);
}
