import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createShareReadDb } from '$lib/server/canvas/canvas-share';
import { readSharedPrototype, sharedPrototypePorts } from '$lib/server/canvas/prototype-share';
import { embedPublished } from '$lib/server/motion/embed';

const HTTP_NOT_FOUND = 404;

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
  const db = createShareReadDb();
  const prototype = await readSharedPrototype(sharedPrototypePorts(db, (nodeId) => embedPublished(db, nodeId)), params.token, url.searchParams.get('frame'));
  if (!prototype) {
    throw error(HTTP_NOT_FOUND, 'Not found');
  }

  setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  return { prototype };
};
