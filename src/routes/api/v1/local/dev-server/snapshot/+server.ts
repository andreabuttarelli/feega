import { error, json } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { localDevServer, posterDeps } from '$lib/server/dev-server/local-dev-server';
import { captureLivePoster } from '$lib/server/dev-server/live-poster';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const UNAVAILABLE = 503;

export const POST: RequestHandler = async ({ request }) => {
  const store = localStore();
  if (!store) {
    error(NOT_FOUND, 'Live frames run only in local mode');
  }

  const { nodeId } = (await request.json()) as { nodeId?: unknown };
  if (typeof nodeId !== 'string') {
    error(BAD_REQUEST, 'nodeId is required');
  }

  const { url } = await localDevServer(store).status();
  if (!url) {
    error(UNAVAILABLE, 'No dev server is running');
  }

  try {
    return json({ poster: await captureLivePoster(nodeId, posterDeps(store, url)) });
  } catch (e) {
    error(BAD_REQUEST, (e as Error).message);
  }
};
