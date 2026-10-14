import { json } from '@sveltejs/kit';
import { authenticate, loadBrandForUser } from '$lib/server/cli-auth';
import type { RequestHandler } from './$types';

/** DELETE — revoke an API key */
export const DELETE: RequestHandler = async ({ request, params }) => {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;

  const { brand, error: brandError } = await loadBrandForUser(auth.supabase, params.slug, auth.apiKey);
  if (brandError) return brandError;

  const { data: key } = await auth.supabase
    .from('api_keys')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', auth.user.id)
    .eq('org_id', brand.org_id)
    .maybeSingle();
  if (!key) {
    return json({ error: 'API key not found' }, { status: 404 });
  }

  const { error } = await auth.supabase
    .from('api_keys')
    .delete()
    .eq('id', params.id)
    .eq('user_id', auth.user.id);

  if (error) return json({ error: error.message }, { status: 500 });

  return json({ deleted: true });
};
