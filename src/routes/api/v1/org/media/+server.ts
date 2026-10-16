import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reachableCaller } from '$lib/server/org-data/reach';
import { loadMedia } from '$lib/server/canvas/node-media';
import { createAssetSigningDb } from '$lib/server/canvas/sign-media';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

function ids(url: URL, key: string): string[] {
  return url.searchParams.getAll(key).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
}

export const GET: RequestHandler = async ({ request, url }) => {
  const nodeIds = ids(url, 'node');
  const runIds = ids(url, 'run');
  const assetIds = ids(url, 'asset');
  if (!nodeIds.length && !runIds.length && !assetIds.length) {
    return json({ error: 'nothing_requested' }, { status: HTTP_BAD_REQUEST });
  }

  const caller = await reachableCaller(request, url, { nodes: nodeIds, runs: runIds, assets: assetIds });
  if (caller instanceof Response) {
    return caller;
  }
  const { db, orgId } = caller;
  const media = await loadMedia(db, createAssetSigningDb(), { orgId, nodeIds, assetIds, runIds });
  if (!media.items.length) {
    return json({ error: 'not_found', ...media }, { status: HTTP_NOT_FOUND });
  }
  return json(media);
};
