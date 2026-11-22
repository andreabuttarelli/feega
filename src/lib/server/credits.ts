import type { SupabaseClient } from '@supabase/supabase-js';

export async function orgCreditBalance(supabase: SupabaseClient, orgId: string): Promise<number> {
  const { data, error } = await supabase.rpc('org_credit_balance', { _org_id: orgId });
  if (error) throw new Error(`org_credit_balance failed: ${error.message}`);
  return Number(data ?? 0);
}
