import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { servePage, type PageHandler } from '$lib/server/api/bearer-page';
import { load } from '$lib/server/root-shell';

const ROOT_PATH = '/';

export const GET: RequestHandler = async (event) => {
  if (!event.request.headers.has('authorization')) {
    return json(await load({ ...event, untrack: (read) => read() }));
  }
  return servePage(event.request, event.url, ROOT_PATH, {}, load as PageHandler);
};
