import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';

const RENAME_ORG_USE = 'src/lib/server/tenancy/rename-org.ts — renameOrg';

export async function renameOrg(input: { orgId: string; name: string }): Promise<void> {
  const use = SERVICE_ROLE_USES.find((entry) => entry.path === RENAME_ORG_USE);
  if (!use) {
    throw new Error(`uso della service role non dichiarato nel registro: ${RENAME_ORG_USE}`);
  }

  const { error } = await createServiceRoleDb(use)
    .from('orgs')
    .update({ name: input.name, updated_at: new Date().toISOString() })
    .eq('id', input.orgId);

  if (error) {
    throw error;
  }
}
