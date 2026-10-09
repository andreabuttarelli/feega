import { error } from '@sveltejs/kit';
import { readEmbed } from '$lib/server/motion/embed';
import type { RequestHandler } from './$types';

const EMBED_CACHE = 'public, max-age=60, s-maxage=60';

export const GET: RequestHandler = async ({ params, fetch, url }) => {
  const html = await readEmbed(fetch, params.id, url.origin);
  if (html === null) {
    throw error(404, 'This embed is not published');
  }
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': EMBED_CACHE } });
};
