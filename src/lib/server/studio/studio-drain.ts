import type { Db } from '$lib/server/db/client';
import { findNode } from '$lib/server/repos/canvas';
import { runGenNode, type StartRun } from '$lib/server/canvas/generate';
import { afterFailure, ItemStatus, ORG_PARALLELISM, pickRunnable } from '$lib/studio/batch-state';
import { dueItems, findBatch, moveItems, runningItems, type BatchItem } from '$lib/server/repos/product-batches';
import { STUDIO_AGENT_KEY } from './studio-batch';

const QUEUE_WINDOW = 50;
const STALE_RUNNING_MS = 10 * 60_000;
const STALE_ERROR = 'timeout: run never came back';

type ItemResult = { status: ItemStatus };

async function failItem(db: Db, item: BatchItem, error: string): Promise<ItemResult> {
  const next = afterFailure(error, item.attempts);
  const patch =
    next.status === ItemStatus.Queued
      ? { status: next.status, error, next_attempt_at: new Date(Date.now() + next.delayMs).toISOString() }
      : { status: next.status, error };
  await moveItems(db, { orgId: item.orgId, itemIds: [item.id], from: [ItemStatus.Running], patch });
  return { status: next.status };
}

async function runItem(db: Db, item: BatchItem): Promise<ItemResult> {
  const batch = await findBatch(db, { orgId: item.orgId, batchId: item.batchId });
  const node = item.genNodeId ? await findNode(db, { orgId: item.orgId, nodeId: item.genNodeId }) : null;
  if (!batch || !node || !batch.canvasId || !batch.productsNodeId) {
    return failItem(db, item, 'node_not_found');
  }

  const userId = batch.actorId;
  const run: StartRun = {
    orgId: item.orgId,
    projectId: batch.projectId,
    canvasId: batch.canvasId,
    nodeId: node.id,
    userId,
    medium: 'image',
    prompt: typeof node.data.prompt === 'string' ? node.data.prompt : '',
    model: item.model,
    params: (node.data.params ?? {}) as StartRun['params'],
    expectedVersion: node.version,
    actor: { kind: 'agent', id: userId, agentKey: STUDIO_AGENT_KEY },
    iterateSelection: { [batch.productsNodeId]: item.productIndex }
  };

  const out = await runGenNode(db, run).catch((e: unknown) => ({ kind: 'refused' as const, error: e instanceof Error ? e.message : String(e) }));

  if (out.kind === 'done') {
    await moveItems(db, {
      orgId: item.orgId,
      itemIds: [item.id],
      from: [ItemStatus.Running],
      patch: { status: ItemStatus.Done, asset_id: out.asset.id, node_run_id: out.run.id, error: null }
    });
    return { status: ItemStatus.Done };
  }
  return failItem(db, item, out.kind === 'refused' ? out.error : out.kind);
}

async function reapStale(db: Db, running: BatchItem[]): Promise<BatchItem[]> {
  const stale = running.filter((r) => Date.now() - Date.parse(r.updatedAt) > STALE_RUNNING_MS);
  await Promise.all(stale.map((item) => failItem(db, item, STALE_ERROR)));
  return running.filter((r) => !stale.includes(r));
}

export type DrainOutcome = { claimed: number; done: number; failed: number; blocked: number; requeued: number };

export async function drainStudio(db: Db, scope: { batchId?: string; perOrg?: number } = {}): Promise<DrainOutcome> {
  const queued = await dueItems(db, { batchId: scope.batchId, limit: QUEUE_WINDOW });
  const orgIds = [...new Set(queued.map((q) => q.orgId))];
  const running = await reapStale(db, await runningItems(db, { orgIds }));
  const picked = pickRunnable(queued, running, scope.perOrg ?? ORG_PARALLELISM);

  const claimed: BatchItem[] = [];
  for (const entry of picked) {
    const item = queued.find((q) => q.id === entry.id)!;
    const [won] = await moveItems(db, {
      orgId: item.orgId,
      itemIds: [item.id],
      from: [ItemStatus.Queued],
      patch: { status: ItemStatus.Running, attempts: item.attempts + 1 }
    });
    if (won) {
      claimed.push(won);
    }
  }

  const results = await Promise.all(claimed.map((item) => runItem(db, item)));
  const count = (status: ItemStatus) => results.filter((r) => r.status === status).length;
  return {
    claimed: claimed.length,
    done: count(ItemStatus.Done),
    failed: count(ItemStatus.Failed),
    blocked: count(ItemStatus.Blocked),
    requeued: count(ItemStatus.Queued)
  };
}
