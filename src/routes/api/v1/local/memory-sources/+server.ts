import { error, json } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { foundSources, readSources } from '$lib/server/local/memory-sources';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;

function requireLocal() {
  if (!localStore()) {
    error(NOT_FOUND, 'Memory import runs only in local mode');
  }
}

export const GET: RequestHandler = async () => {
  requireLocal();
  return json({ sources: await foundSources() });
};

export const POST: RequestHandler = async ({ request }) => {
  requireLocal();
  const { ids } = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const valid = Array.isArray(ids) && ids.every((id) => typeof id === 'string');
  if (!valid) {
    error(BAD_REQUEST, 'ids must be an array of strings');
  }

  return json({ content: await readSources(ids) });
};
