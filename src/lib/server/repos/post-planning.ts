import type { Db } from '$lib/server/db/client';
import type { PostMedia, PostStatus } from './posts';

export enum PlanScope {
  Canvas = 'canvas',
  Brand = 'brand'
}

export const PLAN_SCOPES = [PlanScope.Canvas, PlanScope.Brand] as const;

export type PlanScopeInput = { kind: PlanScope.Canvas; canvasId: string } | { kind: PlanScope.Brand; brandId: string };

export type PlannedPost = {
  id: string;
  brandId: string;
  caption: string;
  media: PostMedia[];
  status: PostStatus;
  plannedFor: string | null;
  updatedAt: string;
  scheduled: boolean;
  sourceNodeIds: string[];
};

const LIVE_STATUSES: PostStatus[] = ['draft', 'ready'];
const PLANNED_COLUMNS = 'id, brand_id, caption, media, status, planned_for, updated_at, zernio_post_ids';

type PlannedRow = {
  id: string;
  brand_id: string;
  caption: string;
  media: PostMedia[] | null;
  status: string;
  planned_for: string | null;
  updated_at: string;
  zernio_post_ids: Record<string, string> | null;
};

function toPlanned(row: PlannedRow, sourceNodeIds: string[]): PlannedPost {
  return {
    id: row.id,
    brandId: row.brand_id,
    caption: row.caption,
    media: row.media ?? [],
    status: row.status as PostStatus,
    plannedFor: row.planned_for,
    updatedAt: row.updated_at,
    scheduled: Object.keys(row.zernio_post_ids ?? {}).length > 0,
    sourceNodeIds
  };
}

async function canvasNodeIds(db: Db, input: { orgId: string; canvasId: string }): Promise<string[]> {
  const { data, error } = await db
    .from('nodes')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('canvas_id', input.canvasId)
    .is('deleted_at', null);
  if (error) {
    throw error;
  }
  return ((data ?? []) as { id: string }[]).map((n) => n.id);
}

async function sourcesOfNodes(db: Db, nodeIds: string[]): Promise<{ post_id: string; node_id: string }[]> {
  if (!nodeIds.length) {
    return [];
  }
  const { data, error } = await db.from('post_sources').select('post_id, node_id').in('node_id', nodeIds);
  if (error) {
    throw error;
  }
  return (data ?? []) as { post_id: string; node_id: string }[];
}

async function sourcesOfPosts(db: Db, postIds: string[]): Promise<{ post_id: string; node_id: string }[]> {
  if (!postIds.length) {
    return [];
  }
  const { data, error } = await db.from('post_sources').select('post_id, node_id').in('post_id', postIds);
  if (error) {
    throw error;
  }
  return (data ?? []) as { post_id: string; node_id: string }[];
}

async function postRows(db: Db, orgId: string, column: 'id' | 'brand_id', value: string | string[]): Promise<PlannedRow[]> {
  const base = db.from('posts').select(PLANNED_COLUMNS).eq('org_id', orgId).in('status', LIVE_STATUSES);
  const query = Array.isArray(value) ? base.in(column, value) : base.eq(column, value);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as PlannedRow[];
}

async function rowsInScope(db: Db, orgId: string, scope: PlanScopeInput): Promise<PlannedRow[]> {
  if (scope.kind === PlanScope.Brand) {
    return postRows(db, orgId, 'brand_id', scope.brandId);
  }

  const nodeIds = await canvasNodeIds(db, { orgId, canvasId: scope.canvasId });
  const postIds = [...new Set((await sourcesOfNodes(db, nodeIds)).map((s) => s.post_id))];
  if (!postIds.length) {
    return [];
  }
  return postRows(db, orgId, 'id', postIds);
}

export async function listPlannedPosts(db: Db, input: { orgId: string; scope: PlanScopeInput }): Promise<PlannedPost[]> {
  const rows = await rowsInScope(db, input.orgId, input.scope);
  const sources = await sourcesOfPosts(db, rows.map((r) => r.id));

  const nodesByPost = new Map<string, string[]>();
  for (const s of sources) {
    nodesByPost.set(s.post_id, [...(nodesByPost.get(s.post_id) ?? []), s.node_id]);
  }

  return rows.map((row) => toPlanned(row, nodesByPost.get(row.id) ?? []));
}

export async function findPlannedPost(db: Db, input: { orgId: string; postId: string }): Promise<PlannedPost | null> {
  const { data, error } = await db
    .from('posts')
    .select(PLANNED_COLUMNS)
    .eq('org_id', input.orgId)
    .eq('id', input.postId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  const sources = await sourcesOfPosts(db, [input.postId]);
  return toPlanned(data as unknown as PlannedRow, sources.map((s) => s.node_id));
}

export enum PlanOutcome {
  Planned = 'planned',
  Conflict = 'conflict',
  Gone = 'gone'
}

export type PlanResult =
  | { outcome: PlanOutcome.Planned; plannedFor: string | null; updatedAt: string }
  | { outcome: PlanOutcome.Conflict }
  | { outcome: PlanOutcome.Gone };

export async function planPost(
  db: Db,
  input: { orgId: string; postId: string; plannedFor: string | null; expectedUpdatedAt: string }
): Promise<PlanResult> {
  const updatedAt = new Date().toISOString();
  const { data, error } = await db
    .from('posts')
    .update({ planned_for: input.plannedFor, updated_at: updatedAt })
    .eq('org_id', input.orgId)
    .eq('id', input.postId)
    .eq('updated_at', input.expectedUpdatedAt)
    .select('id, updated_at');
  if (error) {
    throw error;
  }
  const [written] = (data ?? []) as { updated_at: string }[];
  if (written) {
    return { outcome: PlanOutcome.Planned, plannedFor: input.plannedFor, updatedAt: written.updated_at };
  }

  const { data: still } = await db.from('posts').select('id').eq('org_id', input.orgId).eq('id', input.postId).maybeSingle();
  return still ? { outcome: PlanOutcome.Conflict } : { outcome: PlanOutcome.Gone };
}
