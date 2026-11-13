import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createShareReadDb } from '$lib/server/canvas/canvas-share';
import { readSharedSource } from '$lib/server/canvas/frame-share';
import { MEDIA_UUID_RE } from '$lib/media-url';

const HTTP_NOT_FOUND = 404;
const NO_STORE = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };

export const GET: RequestHandler = async ({ params }) => {
  if (!MEDIA_UUID_RE.test(params.node)) {
    throw error(HTTP_NOT_FOUND, 'Not found');
  }

  const source = await readSharedSource(createShareReadDb(), params.token, params.node);
  if (!source) {
    throw error(HTTP_NOT_FOUND, 'Not found');
  }
  return json(source, { headers: NO_STORE });
};
