import { error } from '@sveltejs/kit';
import { editorSessionOf } from '$lib/frame-editor/client';
import { briefAttachmentIds } from '$lib/motion/video-brief';
import type { PageLoad } from './$types';

const NOT_FOUND = 404;

export const ssr = false;

export const load: PageLoad = async ({ params, url }) => {
  const session = await editorSessionOf(params.nodeId, briefAttachmentIds(url));
  if (!session) {
    error(NOT_FOUND, 'motion_node_not_found');
  }
  return session;
};
