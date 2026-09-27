import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createShareReadDb, readSharedCanvas, signSharedMedia } from '$lib/server/canvas/canvas-share';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  const db = createShareReadDb();
  const shared = await readSharedCanvas(db, params.token, signSharedMedia(db));
  if (!shared) {
    throw error(404, 'Not found');
  }

  setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  return { shared };
};
