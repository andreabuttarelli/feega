import { error } from '@sveltejs/kit';
import { readHostedEmbed } from '$lib/server/motion/embed';
import { scheduleRebuild } from '$lib/server/motion/embed-rebuild-db';
import type { RequestHandler } from './$types';

const EMBED_CACHE = 'public, max-age=60, s-maxage=60';

export const GET: RequestHandler = async ({ params, fetch, url }) => {
  const embed = await readHostedEmbed(fetch, params.id, url.origin);
  if (embed === null) {
    throw error(404, 'This embed is not published');
  }
  if (embed.legacy) {
    scheduleRebuild(params.id, url.origin);
  }
  return new Response(embed.html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': EMBED_CACHE } });
};
