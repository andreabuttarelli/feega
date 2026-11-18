import { json } from '@sveltejs/kit';
import { openOrg } from '$lib/server/cli-auth';
import type { RequestHandler } from './$types';

/** DELETE — revoke an API key */
export const DELETE: RequestHandler = async ({ request, params }) => {
  const { call, error: authError } = await openOrg(request);
  if (authError) return authError;

  const { data: key } = await call.supabase
    .from('api_keys')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', call.user.id)
    .eq('org_id', call.orgId)
    .maybeSingle();
  if (!key) {
    return json({ error: 'API key not found' }, { status: 404 });
  }

  const { error } = await call.supabase
    .from('api_keys')
    .delete()
    .eq('id', params.id)
    .eq('user_id', call.user.id);

  if (error) return json({ error: error.message }, { status: 500 });

  return json({ deleted: true });
};
