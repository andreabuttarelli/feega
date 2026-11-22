import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { viewerOf } from '$lib/server/plugins/serve';

export const GET: RequestHandler = async ({ request }) => {
  const viewer = await viewerOf(request);
  if (viewer instanceof Response) {
    return viewer;
  }

  return json({ plugins: await viewer.service.list(viewer.userId) });
};
