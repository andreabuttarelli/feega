import type { Db } from '$lib/server/db/client';
import { listItems, type Batch } from '$lib/server/repos/product-batches';
import { signedAssets } from '$lib/server/studio/studio-media';
import { studioBatchSummary, type StudioBatchCard } from '$lib/canvas/studio-batch-node';
import { ItemStatus } from '$lib/studio/batch-state';

const THUMB_LIMIT = 6;

export async function studioBatchCard(db: Db, batch: Pick<Batch, 'id' | 'orgId' | 'name' | 'status'>): Promise<StudioBatchCard> {
  const items = await listItems(db, { orgId: batch.orgId, batchId: batch.id });
  const summary = studioBatchSummary(items);
  const finished = items.flatMap((i) => (i.status === ItemStatus.Done && i.assetId ? [i.assetId] : []));
  const shown = [...new Set([...summary.approvedAssetIds, ...finished])].slice(0, THUMB_LIMIT);
  const { urls } = await signedAssets(db, batch.orgId, shown, 'pickerTile');

  return {
    id: batch.id,
    name: batch.name,
    status: batch.status,
    total: summary.total,
    done: summary.done,
    running: summary.running,
    failed: summary.failed,
    approved: summary.approvedAssetIds.length,
    thumbs: shown.map((id) => urls[id]).filter((url): url is string => Boolean(url)),
    href: `/app/studio/${batch.id}`
  };
}
