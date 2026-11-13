import { createAdminClient } from '$lib/server/supabase-admin';

export type Portion = { amount: number; expiresAt: string | null };

type LedgerRow = { kind: string; amount: number; expires_at: string | null };

const NEVER = Infinity;
const expiryOf = (row: LedgerRow) => (row.expires_at ? new Date(row.expires_at).getTime() : NEVER);

export function portionsOf(rows: LedgerRow[], amount: number): Portion[] | null {
  const live = rows.filter((r) => r.kind === 'grant').sort((a, b) => expiryOf(a) - expiryOf(b));
  let spent = rows.filter((r) => r.kind === 'debit').reduce((sum, r) => sum + r.amount, 0);
  let wanted = amount;
  const portions: Portion[] = [];

  for (const grant of live) {
    const used = Math.min(spent, grant.amount);
    spent -= used;
    const take = Math.min(wanted, grant.amount - used);
    if (take <= 0) {
      continue;
    }
    portions.push({ amount: take, expiresAt: grant.expires_at });
    wanted -= take;
  }
  return wanted > 0 ? null : portions;
}

export type Hold = { amount: number; note: string };

type HeldRow = { kind: string; source: string; amount: number };

export async function holdCredits(orgId: string, holds: Hold[]): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('credit_ledger').select('kind, amount, expires_at').eq('org_id', orgId);
  if (error) {
    throw new Error(`credit ledger read failed: ${error.message}`);
  }
  const total = holds.reduce((sum, h) => sum + h.amount, 0);
  if (!portionsOf((data ?? []) as LedgerRow[], total)) {
    return false;
  }
  const rows = holds.map((h) => ({ org_id: orgId, kind: 'debit', source: 'ai_usage', amount: h.amount, note: h.note }));
  const { error: held } = await admin.from('credit_ledger').insert(rows);
  if (held) {
    throw new Error(`credit hold failed: ${held.message}`);
  }
  return true;
}

export async function refundHold(orgId: string, note: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('credit_ledger').select('kind, source, amount').eq('org_id', orgId).eq('note', note);
  if (error) {
    throw new Error(`credit ledger read failed: ${error.message}`);
  }
  const rows = (data ?? []) as HeldRow[];
  const held = rows.filter((r) => r.kind === 'debit').reduce((sum, r) => sum + r.amount, 0);
  const refunded = rows.some((r) => r.kind === 'grant' && r.source === 'refund');
  if (!held || refunded) {
    return held;
  }
  const { error: back } = await admin.from('credit_ledger').insert({ org_id: orgId, kind: 'grant', source: 'refund', amount: held, note });
  if (back) {
    throw new Error(`credit refund failed: ${back.message}`);
  }
  return held;
}
