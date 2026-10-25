import { orgCreditBalance } from '$lib/server/credits';
import { createAdminClient } from '$lib/server/supabase-admin';

export async function creditsCover(orgId: string, total: number | null): Promise<boolean> {
  if (total === null) {
    return true;
  }
  try {
    return (await orgCreditBalance(createAdminClient(), orgId)) >= total;
  } catch {
    return true;
  }
}
