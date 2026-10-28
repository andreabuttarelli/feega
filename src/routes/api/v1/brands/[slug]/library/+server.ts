import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticate, loadBrandForUser } from '$lib/server/cli-auth';
import { LIBRARY_LOADERS } from '$lib/server/brand-library';
import type { LibraryTab } from '$lib/canvas/brand-library';
import type { Db } from '$lib/server/db/client';

const BAD_REQUEST = 400;

export const GET: RequestHandler = async ({ request, params, url }) => {
  const { supabase, error, apiKey } = await authenticate(request);
  if (error) {
    return error;
  }

  const load = LIBRARY_LOADERS[url.searchParams.get('tab') as LibraryTab];
  if (!load) {
    return json({ error: 'unknown_tab' }, { status: BAD_REQUEST });
  }

  const { brand, error: brandError } = await loadBrandForUser(supabase, params.slug, apiKey);
  if (brandError) {
    return brandError;
  }

  return json({ items: await load(supabase as unknown as Db, { orgId: brand.org_id, brandId: brand.id }) });
};
