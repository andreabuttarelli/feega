import { error, json } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { localDevServer } from '$lib/server/dev-server/local-dev-server';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const CONFLICT = 409;

enum DevAction {
  Start = 'start',
  Stop = 'stop'
}

function server() {
  const store = localStore();
  if (!store) {
    error(NOT_FOUND, 'The dev server runs only in local mode');
  }
  return localDevServer(store);
}

export const GET: RequestHandler = async () => json(await server().status());

export const POST: RequestHandler = async ({ request }) => {
  const dev = server();
  const { action } = (await request.json()) as { action?: unknown };

  if (action === DevAction.Stop) {
    return json(dev.stop());
  }

  if (action !== DevAction.Start) {
    error(BAD_REQUEST, 'action must be start or stop');
  }

  try {
    return json(await dev.start());
  } catch (e) {
    error(CONFLICT, (e as Error).message);
  }
};
