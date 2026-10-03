import { z } from 'zod';
import { Approval, ItemStatus } from '$lib/studio/batch-state';

export type StudioBatchNode = { id: string; batchId: string | null };

export const studioBatchNodeSchema = z.object({
  batchId: z.string().nullable()
});

const STUDIO_BATCH_NODE_SIZE = { w: 360, h: 300 };

export function studioBatchNodeSize(): { w: number; h: number } {
  return STUDIO_BATCH_NODE_SIZE;
}

export function newStudioBatchData(batchId: string | null = null): Record<string, unknown> {
  return { batchId };
}

export function studioBatchOf(row: { id: string; type: string; data: Record<string, unknown> }): StudioBatchNode | null {
  if (row.type !== 'studio_batch') {
    return null;
  }

  const parsed = studioBatchNodeSchema.safeParse({ ...newStudioBatchData(), ...row.data });
  return { id: row.id, batchId: parsed.success ? parsed.data.batchId : null };
}

export type StudioBatchCard = {
  id: string;
  name: string;
  status: string;
  total: number;
  done: number;
  running: number;
  failed: number;
  approved: number;
  thumbs: string[];
  href: string;
};

export type BatchSummary = { total: number; done: number; running: number; failed: number; approvedAssetIds: string[] };

const IN_FLIGHT: ReadonlySet<ItemStatus> = new Set([ItemStatus.Queued, ItemStatus.Running]);
const STOPPED: ReadonlySet<ItemStatus> = new Set([ItemStatus.Failed, ItemStatus.Blocked, ItemStatus.Cancelled]);

export function studioBatchSummary(items: { status: ItemStatus; approval: Approval; assetId: string | null }[]): BatchSummary {
  return {
    total: items.length,
    done: items.filter((i) => i.status === ItemStatus.Done).length,
    running: items.filter((i) => IN_FLIGHT.has(i.status)).length,
    failed: items.filter((i) => STOPPED.has(i.status)).length,
    approvedAssetIds: items.flatMap((i) => (i.status === ItemStatus.Done && i.approval === Approval.Approved && i.assetId ? [i.assetId] : []))
  };
}
