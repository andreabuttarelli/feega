import { createAdminClient } from '$lib/server/supabase-admin';

export type Portion = { amount: number; expiresAt: string | null };

type LedgerRow = { kind: string; amount: number; expires_at: string | null };

const NEVER = Infinity;
const expiryOf = (row: LedgerRow) => (row.expires_at ? new Date(row.expires_at).getTime() : NEVER);

export function portionsOf(rows: LedgerRow[], amount: number, now: Date): Portion[] | null {
  const live = rows.filter((r) => r.kind === 'grant' && expiryOf(r) > now.getTime()).sort((a, b) => expiryOf(a) - expiryOf(b));
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

export function splitPortions(portions: Portion[], amounts: number[]): Portion[][] {
  const left = portions.map((p) => ({ ...p }));
  return amounts.map((amount) => {
    const taken: Portion[] = [];
    let wanted = amount;
    for (const p of left) {
      const take = Math.min(wanted, p.amount);
      if (take <= 0) {
        continue;
      }
      taken.push({ amount: take, expiresAt: p.expiresAt });
      p.amount -= take;
      wanted -= take;
    }
    return taken;
  });
}

export async function holdCredits(orgId: string, amount: number, note: string, now = new Date()): Promise<Portion[] | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('credit_ledger').select('kind, amount, expires_at').eq('org_id', orgId);
  if (error) {
    throw new Error(`credit ledger read failed: ${error.message}`);
  }
  const portions = portionsOf((data ?? []) as LedgerRow[], amount, now);
  if (!portions) {
    return null;
  }
  const { error: held } = await admin.from('credit_ledger').insert({ org_id: orgId, kind: 'debit', source: 'ai_usage', amount, note });
  if (held) {
    throw new Error(`credit hold failed: ${held.message}`);
  }
  return portions;
}

export async function releaseCredits(orgId: string, portions: Portion[], note: string): Promise<void> {
  const rows = portions.filter((p) => p.amount > 0).map((p) => ({ org_id: orgId, kind: 'grant', source: 'refund', amount: p.amount, expires_at: p.expiresAt, note }));
  if (!rows.length) {
    return;
  }
  const { error } = await createAdminClient().from('credit_ledger').insert(rows);
  if (error) {
    throw new Error(`credit release failed: ${error.message}`);
  }
}
