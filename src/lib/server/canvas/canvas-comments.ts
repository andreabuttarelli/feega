import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { commentBodyError, threadsOf, type CommentRow, type CommentThread } from '$lib/canvas/comment-threads';

type Scope = { orgId: string; canvasId: string };

type Row = { id: string; node_id: string | null; parent_id: string | null; author_id: string; x: number; y: number; body: string; resolved_at: string | null; created_at: string };

type Result<T> = Promise<{ data: T | null; error: unknown }>;

type Query<T> = Result<T> & {
  eq: (col: string, v: string) => Query<T>;
  is: (col: string, v: null) => Query<T>;
  select: (cols: string) => Query<T>;
  single: () => Result<Row>;
  maybeSingle: () => Result<Row>;
};

type CommentTable = {
  from: (table: 'canvas_comments') => {
    select: (cols: string) => Query<Row[]>;
    insert: (row: Record<string, unknown>) => Query<Row[]>;
    update: (patch: Record<string, unknown>) => Query<Row[]>;
  };
};

const COLUMNS = 'id, node_id, parent_id, author_id, x, y, body, resolved_at, created_at';

const comments = (db: Db) => (db as unknown as CommentTable).from('canvas_comments');

const rowOf = (r: Row): CommentRow => ({ id: r.id, nodeId: r.node_id, parentId: r.parent_id, authorId: r.author_id, x: r.x, y: r.y, body: r.body, resolvedAt: r.resolved_at, createdAt: r.created_at });

export enum CommentOutcome {
  Added = 'added',
  Invalid = 'invalid',
  Missing = 'missing'
}

export type NewComment = Scope & { body: string; actor: Actor; nodeId?: string | null; parentId?: string | null; x?: number; y?: number };

export async function listComments(db: Db, scope: Scope): Promise<CommentThread[]> {
  const { data, error } = await comments(db).select(COLUMNS).eq('org_id', scope.orgId).eq('canvas_id', scope.canvasId).is('deleted_at', null);
  if (error) {
    throw error;
  }
  return threadsOf((data ?? []).map(rowOf));
}

async function pinTarget(db: Db, input: NewComment): Promise<boolean> {
  if (input.parentId) {
    const { data } = await comments(db).select('id').eq('org_id', input.orgId).eq('canvas_id', input.canvasId).eq('id', input.parentId).is('parent_id', null).is('deleted_at', null).maybeSingle();
    return !!data;
  }
  if (input.nodeId) {
    const { data } = await (db as unknown as { from: (t: 'nodes') => { select: (c: string) => Query<Row[]> } }).from('nodes').select('id').eq('org_id', input.orgId).eq('canvas_id', input.canvasId).eq('id', input.nodeId).is('deleted_at', null).maybeSingle();
    return !!data;
  }
  return true;
}

export async function addComment(db: Db, input: NewComment): Promise<{ outcome: CommentOutcome; id?: string }> {
  if (commentBodyError(input.body) || !input.actor.id) {
    return { outcome: CommentOutcome.Invalid };
  }
  if (!(await pinTarget(db, input))) {
    return { outcome: CommentOutcome.Missing };
  }

  const { data, error } = await comments(db)
    .insert({ org_id: input.orgId, canvas_id: input.canvasId, node_id: input.parentId ? null : (input.nodeId ?? null), parent_id: input.parentId ?? null, author_id: input.actor.id, x: input.x ?? 0, y: input.y ?? 0, body: input.body.trim() })
    .select('id')
    .single();
  if (error || !data) {
    throw error ?? new Error('comment not saved');
  }
  return { outcome: CommentOutcome.Added, id: data.id };
}

export async function resolveThread(db: Db, input: Scope & { commentId: string; resolved: boolean }): Promise<CommentOutcome> {
  const { data, error } = await comments(db)
    .update({ resolved_at: input.resolved ? new Date().toISOString() : null })
    .eq('org_id', input.orgId)
    .eq('canvas_id', input.canvasId)
    .eq('id', input.commentId)
    .is('parent_id', null)
    .select('id');
  if (error) {
    throw error;
  }
  return data?.length ? CommentOutcome.Added : CommentOutcome.Missing;
}
