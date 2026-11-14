import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const APPLY_FLAG = '--apply';
const OWNER_ROLE = 'owner';

const apply = process.argv.includes(APPLY_FLAG);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
const db = createClient(process.env.PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');

type OrgRow = {
  id: string;
  stripe_customer_id: string;
  orgs_members: { role: string; user_id: string; created_at: string }[];
};

async function ownerEmail(org: OrgRow): Promise<string | null> {
  const owner = org.orgs_members
    .filter((m) => m.role === OWNER_ROLE)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (!owner) {
    return null;
  }

  const { data } = await db.auth.admin.getUserById(owner.user_id);
  return data.user?.email ?? null;
}

async function backfill(org: OrgRow): Promise<string> {
  const customer = await stripe.customers.retrieve(org.stripe_customer_id);
  if (customer.deleted) {
    return 'skip deleted';
  }
  if (customer.email) {
    return 'skip has email';
  }

  const email = await ownerEmail(org);
  if (!email) {
    return 'skip no owner email';
  }
  if (!apply) {
    return `would set ${email}`;
  }

  await stripe.customers.update(org.stripe_customer_id, { email });
  return `set ${email}`;
}

const { data, error } = await db
  .from('orgs')
  .select('id, stripe_customer_id, orgs_members(role, user_id, created_at)')
  .not('stripe_customer_id', 'is', null);
if (error) {
  throw error;
}

console.log(apply ? 'APPLY' : 'DRY RUN (pass --apply to write)');
for (const org of (data ?? []) as unknown as OrgRow[]) {
  console.log(org.id, org.stripe_customer_id, await backfill(org));
}
