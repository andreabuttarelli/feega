import type { Db } from '$lib/server/db/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '$lib/server/email';
import { OrgRoleName } from '$lib/org-roles';
import { PLAN } from '$lib/credit-ladder';
import { BILLING_PATH } from '$lib/billing-path';

type OwnerRow = { profiles?: { email?: string | null } | null };

async function ownerEmail(db: Db, orgId: string): Promise<string | null> {
  const { data } = await (db as unknown as SupabaseClient).from('orgs_members').select('profiles!inner(email)').eq('org_id', orgId).eq('role', OrgRoleName.Owner);
  return ((data ?? []) as OwnerRow[]).map((r) => r.profiles?.email).find((e): e is string => !!e) ?? null;
}

export async function tellOwnerOfSeat(db: Db, input: { orgId: string; editorEmail?: string }): Promise<void> {
  try {
    const to = await ownerEmail(db, input.orgId);
    if (!to) {
      return;
    }
    const who = input.editorEmail ? `${input.editorEmail} accepted your invite as an editor.` : 'Your team has more editors than your plan was billing.';
    const text = `${who} Your plan now bills one more editor seat (€${PLAN.price} per month, prorated for the rest of this period), and the seat's credits are in your balance. Manage editors and billing at ${BILLING_PATH}.`;
    await sendEmail({ to, subject: 'A new editor joined your feega team', html: `<p>${text}</p>`, text });
  } catch (e) {
    console.error('[seats] owner not told of a new seat', input.orgId, e);
  }
}
