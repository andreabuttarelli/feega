import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openCloudSessionCall } from '$lib/server/cloud/access';
import { reviewOf } from '$lib/server/cloud/revisions';

export const GET: RequestHandler = async ({ request, params }) => {
  const opened = await openCloudSessionCall(request, params.id);
  if (opened instanceof Response) {
    return opened;
  }

  return json(await reviewOf(opened.call.supabase, opened.session.id));
};
