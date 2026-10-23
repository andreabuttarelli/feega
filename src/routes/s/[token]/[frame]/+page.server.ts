import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createShareReadDb } from '$lib/server/canvas/canvas-share';
import { readSharedFrame } from '$lib/server/canvas/frame-share';
import { embedPublished } from '$lib/server/motion/embed';
import { embedUrl } from '$lib/motion/interactive/bundle';
import { Fit } from '$lib/motion/interactive/fit';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  const db = createShareReadDb();
  const frame = await readSharedFrame(db, params.token, params.frame, (nodeId) => embedPublished(db, nodeId));
  if (!frame) {
    throw error(404, 'Not found');
  }

  setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  return { frame, embedSrc: `${embedUrl('', frame.frameId)}?fit=${Fit.Contain}` };
};
