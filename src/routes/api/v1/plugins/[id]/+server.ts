import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { answer, viewerOf } from '$lib/server/plugins/serve';

export const GET: RequestHandler = async ({ request, params }) => {
  const viewer = await viewerOf(request);
  if (viewer instanceof Response) {
    return viewer;
  }

  const plugin = await viewer.service.get(viewer.userId, params.id);
  if (!plugin) {
    return answer({ ok: false, error: 'not_found' });
  }

  return json({ plugin });
};
