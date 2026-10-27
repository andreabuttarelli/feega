import { error, json } from '@sveltejs/kit';
import { readGpuSource } from '$lib/server/motion/embed';
import type { RequestHandler } from './$types';

const SOURCE_HEADERS = { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=60, s-maxage=60' };

export const GET: RequestHandler = async ({ params, fetch, url }) => {
  const source = await readGpuSource(fetch, params.id, url.origin);
  if (source === null) {
    throw error(404, 'This embed has no gpu source');
  }
  return json(source, { headers: SOURCE_HEADERS });
};
