import type { LayoutServerLoad } from './$types';
import { affordableSeats } from '$lib/server/social-connections';
import { ACCOUNT_SEAT_USD } from '$lib/credit-ladder';
import { orgCreditBalance } from '$lib/server/credits';
import { orgBillingForBrand } from '$lib/server/org-billing';
import { listOrgBrands } from '$lib/server/repos/brands';
import { sectionRequiresBrand } from '$lib/components/settings/platforms';
import type { ProjectBrandShell } from '$lib/server/projects/brand-shell';
import type { Db } from '$lib/server/db/client';

const ORG_OWNER_ROLE = 'owner';

async function brandSeats(supabase: Db, brand: ProjectBrandShell) {
  const [{ data: accounts }, billing, balance] = await Promise.all([
    supabase
      .from('social_accounts')
      .select('id, platform, handle, display_name, status')
      .eq('brand_id', brand.id)
      .order('connected_at', { ascending: true }),
    orgBillingForBrand(supabase, { id: brand.id }),
    orgCreditBalance(supabase, brand.org_id)
  ]);

  const list = accounts ?? [];
  const used = list.filter((a) => a.status === 'active').length;
  return { accounts: list, limit: used + affordableSeats(balance), used, hasBilling: !!billing?.customerId };
}

const NO_SEATS = { accounts: [], limit: 0, used: 0, hasBilling: false };

export const load: LayoutServerLoad = async ({ parent, url, locals: { supabase } }) => {
  const { brand, org } = await parent();
  const brandGate = !brand && sectionRequiresBrand(url.pathname);

  const [seats, { data: apiKeys }, { data: invites }, orgBrands] = await Promise.all([
    brand ? brandSeats(supabase, brand) : NO_SEATS,
    supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, created_at, last_used_at')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orgs_invites')
      .select('id, email, accepted_at, created_at')
      .eq('org_id', org.id)
      .order('created_at', { ascending: true }),
    brandGate ? listOrgBrands(supabase, org.id) : []
  ]);

  return {
    brand,
    brandGate,
    orgBrands: orgBrands.map((b) => ({ id: b.id, name: b.name })),
    ...seats,
    seatCostUsd: ACCOUNT_SEAT_USD,
    apiKeys: apiKeys ?? [],
    isOwner: org.role === ORG_OWNER_ROLE,
    invites: invites ?? []
  };
};
