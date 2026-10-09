import { error, json } from '@sveltejs/kit';
import { readEmbedSettings } from '$lib/server/motion/embed';
import type { RequestHandler } from './$types';

const SETTINGS_HEADERS = { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=60, s-maxage=60' };

export const GET: RequestHandler = async ({ params, fetch }) => {
  const settings = await readEmbedSettings(fetch, params.id);
  if (settings === null) {
    throw error(404, 'This embed is not published');
  }
  return json(settings, { headers: SETTINGS_HEADERS });
};
