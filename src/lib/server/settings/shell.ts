import type { SharedEvent } from './event';

const ORG_OWNER_ROLE = 'owner';

export const load = async ({ parent, locals: { supabase } }: SharedEvent) => {
  const { org } = await parent();

  const [{ data: apiKeys }, { data: invites }] = await Promise.all([
    supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, created_at, last_used_at')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orgs_invites')
      .select('id, email, accepted_at, created_at')
      .eq('org_id', org.id)
      .order('created_at', { ascending: true })
  ]);

  return {
    apiKeys: apiKeys ?? [],
    isOwner: org.role === ORG_OWNER_ROLE,
    invites: invites ?? []
  };
};
