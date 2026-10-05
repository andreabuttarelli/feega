import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { ItemStatus, Approval } from '$lib/studio/batch-state';

export enum BatchStatus {
  Draft = 'draft',
  Running = 'running',
  Cancelled = 'cancelled'
}

export type BatchSpec = {
  styleRefs: { source: 'catalogue' | 'asset'; id: string }[];
  cells: Record<string, string>;
  modelNodes: Record<string, string>;
  droppedRefs: number;
};

export type Batch = {
  id: string;
  orgId: string;
  projectId: string;
  canvasId: string | null;
  productsNodeId: string | null;
  name: string;
  model: string;
  previewModel: string;
  status: BatchStatus;
  spec: BatchSpec;
  actorId: string;
  createdAt: string;
};

export type BatchItem = {
  id: string;
  orgId: string;
  batchId: string;
  genNodeId: string | null;
  productIndex: number;
  productTitle: string;
  influencerId: string | null;
  environment: string;
  shot: string;
  variation: number;
  preview: boolean;
  model: string;
  status: ItemStatus;
  attempts: number;
  error: string | null;
  assetId: string | null;
  nodeRunId: string | null;
  approval: Approval;
  updatedAt: string;
};

export type NewItem = Omit<BatchItem, 'id' | 'status' | 'attempts' | 'error' | 'assetId' | 'nodeRunId' | 'approval' | 'updatedAt'>;

type Row = Record<string, unknown>;

function untyped(db: Db): SupabaseClient {
  return db as unknown as SupabaseClient;
}

function toBatch(row: Row): Batch {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    projectId: row.project_id as string,
    canvasId: row.canvas_id as string | null,
    productsNodeId: row.products_node_id as string | null,
    name: row.name as string,
    model: row.model as string,
    previewModel: row.preview_model as string,
    status: row.status as BatchStatus,
    spec: { styleRefs: [], cells: {}, modelNodes: {}, droppedRefs: 0, ...(row.spec as Partial<BatchSpec>) },
    actorId: row.actor_id as string,
    createdAt: row.created_at as string
  };
}

function toItem(row: Row): BatchItem {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    batchId: row.batch_id as string,
    genNodeId: row.gen_node_id as string | null,
    productIndex: row.product_index as number,
    productTitle: row.product_title as string,
    influencerId: row.influencer_id as string | null,
    environment: row.environment as string,
    shot: row.shot as string,
    variation: row.variation as number,
    preview: row.preview as boolean,
    model: row.model as string,
    status: row.status as ItemStatus,
    attempts: row.attempts as number,
    error: row.error as string | null,
    assetId: row.asset_id as string | null,
    nodeRunId: row.node_run_id as string | null,
    approval: row.approval as Approval,
    updatedAt: row.updated_at as string
  };
}

function rows(result: { data: unknown; error: unknown }): Row[] {
  if (result.error) {
    throw result.error;
  }
  return (result.data ?? []) as Row[];
}

export async function insertBatch(
  db: Db,
  input: { orgId: string; projectId: string; name: string; model: string; previewModel: string; spec: BatchSpec; actorId: string }
): Promise<Batch> {
  const result = await untyped(db)
    .from('product_batches')
    .insert({
      org_id: input.orgId,
      project_id: input.projectId,
      name: input.name,
      model: input.model,
      preview_model: input.previewModel,
      spec: input.spec,
      actor_id: input.actorId
    })
    .select('*');
  return toBatch(rows(result)[0]);
}

export async function updateBatch(
  db: Db,
  input: { orgId: string; batchId: string; patch: Partial<{ canvas_id: string; products_node_id: string; status: BatchStatus; spec: BatchSpec; model: string }> }
): Promise<void> {
  const result = await untyped(db)
    .from('product_batches')
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq('org_id', input.orgId)
    .eq('id', input.batchId);
  rows(result);
}

export async function findBatch(db: Db, scope: { orgId: string; batchId: string }): Promise<Batch | null> {
  const result = await untyped(db).from('product_batches').select('*').eq('org_id', scope.orgId).eq('id', scope.batchId);
  const found = rows(result)[0];
  return found ? toBatch(found) : null;
}

export async function listBatches(db: Db, scope: { orgId: string; projectId: string }): Promise<Batch[]> {
  const result = await untyped(db)
    .from('product_batches')
    .select('*')
    .eq('org_id', scope.orgId)
    .eq('project_id', scope.projectId)
    .order('created_at', { ascending: false })
    .limit(50);
  return rows(result).map(toBatch);
}

export async function insertItems(db: Db, items: NewItem[]): Promise<BatchItem[]> {
  if (!items.length) {
    return [];
  }
  const result = await untyped(db)
    .from('product_batch_items')
    .insert(
      items.map((i) => ({
        org_id: i.orgId,
        batch_id: i.batchId,
        gen_node_id: i.genNodeId,
        product_index: i.productIndex,
        product_title: i.productTitle,
        influencer_id: i.influencerId,
        environment: i.environment,
        shot: i.shot,
        variation: i.variation,
        preview: i.preview,
        model: i.model
      }))
    )
    .select('*');
  return rows(result).map(toItem);
}

export async function listItems(db: Db, scope: { orgId: string; batchId: string }): Promise<BatchItem[]> {
  const result = await untyped(db)
    .from('product_batch_items')
    .select('*')
    .eq('org_id', scope.orgId)
    .eq('batch_id', scope.batchId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  return rows(result).map(toItem);
}

export type ItemPatch = Partial<{
  status: ItemStatus;
  attempts: number;
  error: string | null;
  asset_id: string | null;
  node_run_id: string | null;
  approval: Approval;
  next_attempt_at: string;
}>;

export async function moveItems(
  db: Db,
  input: { orgId: string; itemIds: string[]; from: ItemStatus[]; patch: ItemPatch }
): Promise<BatchItem[]> {
  if (!input.itemIds.length) {
    return [];
  }
  const result = await untyped(db)
    .from('product_batch_items')
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq('org_id', input.orgId)
    .in('id', input.itemIds)
    .in('status', input.from)
    .select('*');
  return rows(result).map(toItem);
}

export async function setApproval(db: Db, input: { orgId: string; itemId: string; approval: Approval }): Promise<void> {
  const result = await untyped(db)
    .from('product_batch_items')
    .update({ approval: input.approval, updated_at: new Date().toISOString() })
    .eq('org_id', input.orgId)
    .eq('id', input.itemId)
    .eq('status', ItemStatus.Done);
  rows(result);
}

export async function dueItems(db: Db, scope: { batchId?: string; limit: number }): Promise<BatchItem[]> {
  let query = untyped(db)
    .from('product_batch_items')
    .select('*')
    .eq('status', ItemStatus.Queued)
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(scope.limit);
  if (scope.batchId) {
    query = query.eq('batch_id', scope.batchId);
  }
  return rows(await query).map(toItem);
}

export async function runningItems(db: Db, scope: { orgIds: string[] }): Promise<BatchItem[]> {
  if (!scope.orgIds.length) {
    return [];
  }
  const result = await untyped(db).from('product_batch_items').select('*').eq('status', ItemStatus.Running).in('org_id', scope.orgIds);
  return rows(result).map(toItem);
}
