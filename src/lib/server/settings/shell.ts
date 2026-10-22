import type { SettingsEvent } from './event';
import { listOrgBrands } from '$lib/server/repos/brands';
import { sectionRequiresBrand } from '$lib/components/settings/platforms';

const ORG_OWNER_ROLE = 'owner';

export const load = async ({ parent, url, locals: { supabase } }: SettingsEvent) => {
  const { brand, org } = await parent();
  const brandGate = !brand && sectionRequiresBrand(url.pathname);

  const [{ data: apiKeys }, { data: invites }, orgBrands] = await Promise.all([
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
    apiKeys: apiKeys ?? [],
    isOwner: org.role === ORG_OWNER_ROLE,
    invites: invites ?? []
  };
};
