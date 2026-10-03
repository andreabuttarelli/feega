import { error } from '@sveltejs/kit';
import { zipSync } from 'fflate';
import type { RequestHandler } from './$types';
import { studioScope } from '$lib/server/studio/studio-scope';
import { findBatch, listItems } from '$lib/server/repos/product-batches';
import { signedAssets } from '$lib/server/studio/studio-media';
import { approvedFiles, slug } from '$lib/studio/zip-names';
import { Approval, ItemStatus } from '$lib/studio/batch-state';

export const config = { maxDuration: 300 };

const HTTP_NOT_FOUND = 404;

export const GET: RequestHandler = async (event) => {
  const { db, orgId, projectId } = await studioScope(event);
  const batch = await findBatch(db, { orgId, batchId: event.params.batchId });
  if (!batch || batch.projectId !== projectId) {
    throw error(HTTP_NOT_FOUND, 'Batch not found');
  }

  const items = (await listItems(db, { orgId, batchId: batch.id })).filter((i) => i.status === ItemStatus.Done && i.approval === Approval.Approved && i.assetId);
  if (!items.length) {
    throw error(HTTP_NOT_FOUND, 'Approve at least one photo first');
  }

  const { assets, urls } = await signedAssets(db, orgId, items.map((i) => i.assetId!));
  const files = approvedFiles(items.map((i) => ({ ...i, mime: assets.get(i.assetId!)?.mimeType ?? null })));
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    const url = urls[file.assetId];
    if (!url) {
      continue;
    }
    const response = await fetch(url);
    if (response.ok) {
      entries[file.name] = new Uint8Array(await response.arrayBuffer());
    }
  }

  const zip = zipSync(entries, { level: 0 });
  return new Response(zip, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${slug(batch.name)}.zip"`
    }
  });
};
