import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { studioRequest } from '$lib/server/studio/studio-api';
import { quoteIdOf, summarize } from '$lib/server/studio/studio-quote';

export const POST: RequestHandler = async ({ request, url }) => {
  const resolved = await studioRequest(request, url);
  if (resolved instanceof Response) {
    return resolved;
  }

  const summary = summarize(resolved.quote);
  return json({ ...summary, quoteId: quoteIdOf(resolved.selection, summary) });
};
