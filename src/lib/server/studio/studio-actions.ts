import type { Batch } from '$lib/server/repos/product-batches';
import type { ToolScope } from '$lib/server/dashboard/tool-scope';
import { gateOrgAiActionForForm } from '$lib/server/cli-auth';
import { drainStudio } from './studio-drain';
import { studioOptions } from './studio-options';
import { approveItem, cancelBatch, moreVariations, requeueItems, runBatch } from './studio-batch';
import { Approval, ItemStatus } from '$lib/studio/batch-state';
import { MAX_VARIATIONS } from '$lib/studio/plan';

const HTTP_UNPROCESSABLE = 422;

export enum BatchAction {
  Run = 'run',
  More = 'more',
  Cancel = 'cancel',
  Retry = 'retry',
  Regenerate = 'regenerate',
  Approve = 'approve',
  Reject = 'reject',
  Drain = 'drain'
}

export type ActionInput = { itemIds: string[]; variations: number };

export type ActionResult = { data: Record<string, unknown> } | { status: number; error: string };

export type BatchScope = ToolScope & { batch: Batch };

const SPENDING: ReadonlySet<BatchAction> = new Set([BatchAction.Run, BatchAction.More, BatchAction.Retry, BatchAction.Regenerate]);

const OK = { data: { ok: true } };

const unprocessable = (error: string): ActionResult => ({ status: HTTP_UNPROCESSABLE, error });

type Handler = (scope: BatchScope, input: ActionInput) => Promise<ActionResult>;

const decide = async (scope: BatchScope, approval: Approval, input: ActionInput): Promise<ActionResult> => {
  await approveItem(scope.db, scope, { itemId: input.itemIds[0], approval });
  return OK;
};

const requeue = (from: ItemStatus[]): Handler => async (scope, input) => ({
  data: { requeued: await requeueItems(scope.db, scope, { batchId: scope.batch.id, itemIds: input.itemIds, from }) }
});

const HANDLERS: Record<BatchAction, Handler> = {
  [BatchAction.Run]: async (scope) => {
    const outcome = await runBatch(scope.db, scope, scope.batch.id, await studioOptions(scope.db, scope));
    return 'error' in outcome ? unprocessable(outcome.error) : OK;
  },
  [BatchAction.More]: async (scope, input) => {
    const variations = Math.min(Math.max(input.variations, 1), MAX_VARIATIONS);
    const outcome = await moreVariations(scope.db, scope, scope.batch.id, await studioOptions(scope.db, scope), variations);
    return 'error' in outcome ? unprocessable(outcome.error) : OK;
  },
  [BatchAction.Cancel]: async (scope) => ({ data: { cancelled: await cancelBatch(scope.db, scope, scope.batch.id) } }),
  [BatchAction.Retry]: requeue([ItemStatus.Failed, ItemStatus.Cancelled]),
  [BatchAction.Regenerate]: requeue([ItemStatus.Done]),
  [BatchAction.Approve]: (scope, input) => decide(scope, Approval.Approved, input),
  [BatchAction.Reject]: (scope, input) => decide(scope, Approval.Rejected, input),
  [BatchAction.Drain]: async (scope) => ({ data: { drained: await drainStudio(scope.db, { batchId: scope.batch.id }) } })
};

export function isBatchAction(name: string): name is BatchAction {
  return name in HANDLERS;
}

export async function applyAction(scope: BatchScope, action: BatchAction, input: ActionInput): Promise<ActionResult> {
  if (SPENDING.has(action)) {
    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return { status: denied.status, error: denied.data.message };
    }
  }
  return HANDLERS[action](scope, input);
}
