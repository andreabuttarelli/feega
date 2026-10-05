import { error } from '@sveltejs/kit';
import { zipSync } from 'fflate';
import type { RequestHandler } from './$types';
import { batchScope } from '$lib/server/dashboard/tool-scope';
import { listItems } from '$lib/server/repos/product-batches';
import { signedAssets } from '$lib/server/studio/studio-media';
import { approvedFiles, slug } from '$lib/studio/zip-names';
import { Approval, ItemStatus } from '$lib/studio/batch-state';
import { isMarketplace, type Marketplace } from '$lib/studio/marketplace';
import { toMarketplace } from '$lib/server/studio/marketplace-image';

export const config = { maxDuration: 300 };

const HTTP_NOT_FOUND = 404;
const FORMAT_PARAM = 'format';
const EXTENSION = /\.[a-z0-9]+$/;

async function entryFor(name: string, bytes: Uint8Array, market: Marketplace | null): Promise<[string, Uint8Array]> {
  if (!market) {
    return [name, bytes];
  }
  const converted = await toMarketplace(bytes, market);
  return [name.replace(EXTENSION, `-${market}.${converted.extension}`), converted.bytes];
}

export const GET: RequestHandler = async (event) => {
  const { db, orgId, batch } = await batchScope(event);
  const format = event.url.searchParams.get(FORMAT_PARAM);
  const market = isMarketplace(format) ? format : null;

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
    if (!response.ok) {
      continue;
    }
    const [name, bytes] = await entryFor(file.name, new Uint8Array(await response.arrayBuffer()), market);
    entries[name] = bytes;
  }

  const zip = zipSync(entries, { level: 0 });
  return new Response(zip, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${slug(batch.name)}${market ? `-${market}` : ''}.zip"`
    }
  });
};
