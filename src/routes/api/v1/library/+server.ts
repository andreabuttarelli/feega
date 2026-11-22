import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openOrg } from '$lib/server/cli-auth';
import { cloudEntitled } from '$lib/server/cloud/entitlement';
import { catalogue } from '$lib/server/library/library';
import { storageStore } from '$lib/server/library/storage-store';

export const GET: RequestHandler = async ({ request }) => {
  const opened = await openOrg(request);
  if (opened.error) {
    return opened.error;
  }

  const { supabase, orgId } = opened.call;
  const items = await catalogue(storageStore(), await cloudEntitled(supabase, orgId));

  return json({ items });
};
