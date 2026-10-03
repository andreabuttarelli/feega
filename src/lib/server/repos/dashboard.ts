import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import type { NodeType } from '$lib/canvas/node-data';

export type RecentCanvas = { id: string; projectId: string; name: string; updatedAt: string };
export type RecentImage = { id: string; projectId: string };
export type RecentBatch = { id: string; projectId: string; name: string; status: string; createdAt: string };
export type RecentNode = { id: string; projectId: string; canvasId: string; name: string | null; data: Record<string, unknown>; updatedAt: string };

type Scope = { orgId: string; limit: number };

function rowsOf<T>(result: { data: unknown; error: unknown }): T[] {
  if (result.error) {
    throw result.error;
  }
  return (result.data ?? []) as T[];
}

export async function listRecentCanvases(db: Db, scope: Scope): Promise<RecentCanvas[]> {
  const result = await db
    .from('canvases')
    .select('id, project_id, name, updated_at')
    .eq('org_id', scope.orgId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(scope.limit);
  return rowsOf<{ id: string; project_id: string; name: string; updated_at: string }>(result).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    updatedAt: r.updated_at
  }));
}

export async function listRecentImages(db: Db, scope: Scope): Promise<RecentImage[]> {
  const result = await db
    .from('assets')
    .select('id, project_id')
    .eq('org_id', scope.orgId)
    .eq('type', 'image')
    .eq('uncensored', false)
    .not('project_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(scope.limit);
  return rowsOf<{ id: string; project_id: string }>(result).map((r) => ({ id: r.id, projectId: r.project_id }));
}

export async function listRecentBatches(db: Db, scope: Scope): Promise<RecentBatch[]> {
  const result = await (db as unknown as SupabaseClient)
    .from('product_batches')
    .select('id, project_id, name, status, created_at')
    .eq('org_id', scope.orgId)
    .order('created_at', { ascending: false })
    .limit(scope.limit);
  return rowsOf<{ id: string; project_id: string; name: string; status: string; created_at: string }>(result).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    status: r.status,
    createdAt: r.created_at
  }));
}

export async function listRecentNodes(db: Db, scope: Scope & { type: NodeType }): Promise<RecentNode[]> {
  const result = await db
    .from('nodes')
    .select('id, project_id, canvas_id, display_name, data, updated_at')
    .eq('org_id', scope.orgId)
    .eq('type', scope.type)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(scope.limit);
  return rowsOf<{ id: string; project_id: string; canvas_id: string; display_name: string | null; data: unknown; updated_at: string }>(result).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    canvasId: r.canvas_id,
    name: r.display_name,
    data: (r.data ?? {}) as Record<string, unknown>,
    updatedAt: r.updated_at
  }));
}
