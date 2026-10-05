import { createAdminClient } from '$lib/server/supabase-admin';
import { orgCreditBalance } from '$lib/server/credits';

export async function holdCredits(orgId: string, amount: number, note: string): Promise<boolean> {
  const admin = createAdminClient();
  if ((await orgCreditBalance(admin, orgId)) < amount) {
    return false;
  }
  const { error } = await admin.from('credit_ledger').insert({ org_id: orgId, kind: 'debit', source: 'ai_usage', amount, note });
  if (error) {
    throw new Error(`credit hold failed: ${error.message}`);
  }
  return true;
}

export async function releaseCredits(orgId: string, amount: number, note: string): Promise<void> {
  if (amount <= 0) {
    return;
  }
  const { error } = await createAdminClient().from('credit_ledger').insert({ org_id: orgId, kind: 'grant', source: 'refund', amount, note });
  if (error) {
    throw new Error(`credit release failed: ${error.message}`);
  }
}
