import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import { listMembers } from '$lib/server/repos/orgs';
import type { Actor } from '$lib/server/repos/actor';
import { AGENT_MENTION_ID, agentTeammate } from '$lib/canvas/comment-agent';
import { commentBodyError, threadsOf, type CommentRow, type CommentThread } from '$lib/canvas/comment-threads';

type Scope = { orgId: string; canvasId: string };

type Row = { id: string; node_id: string | null; parent_id: string | null; author_id: string; x: number; y: number; body: string; resolved_at: string | null; time_ms: number | null; edited_at: string | null; mentions: string[]; created_at: string };

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

const COLUMNS = 'id, node_id, parent_id, author_id, x, y, body, resolved_at, time_ms, edited_at, mentions, created_at';

const comments = (db: Db) => (db as unknown as CommentTable).from('canvas_comments');

const rowOf = (r: Row): CommentRow => ({ id: r.id, nodeId: r.node_id, parentId: r.parent_id, authorId: r.author_id, x: r.x, y: r.y, body: r.body, resolvedAt: r.resolved_at, timeMs: r.time_ms, mentions: r.mentions ?? [], editedAt: r.edited_at, createdAt: r.created_at });

export async function commentNodeId(db: Db, scope: Scope & { id: string }): Promise<string | null> {
  const { data } = await comments(db).select('node_id').eq('org_id', scope.orgId).eq('canvas_id', scope.canvasId).eq('id', scope.id).maybeSingle();
  return data?.node_id ?? null;
}

export enum CommentOutcome {
  Added = 'added',
  Invalid = 'invalid',
  Missing = 'missing'
}

export type NewComment = Scope & { id?: string; body: string; actor: Actor; nodeId?: string | null; parentId?: string | null; x?: number; y?: number; timeMs?: number | null; mentions?: string[]; byAgent?: boolean };

export type Teammate = { id: string; name: string };

export async function listComments(db: Db, scope: Scope): Promise<CommentThread[]> {
  const { data, error } = await comments(db).select(COLUMNS).eq('org_id', scope.orgId).eq('canvas_id', scope.canvasId).is('deleted_at', null);
  if (error) {
    throw error;
  }
  return threadsOf((data ?? []).map(rowOf));
}

const momentOf = (ms: number | null | undefined): number | null => (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : null);

export async function teammates(db: Db, orgId: string): Promise<Teammate[]> {
  const members = await listMembers(db, orgId);
  return [...members.map((m) => ({ id: m.userId, name: m.name ?? m.email })), agentTeammate()];
}

async function mentionable(db: Db, orgId: string, ids: string[] | undefined): Promise<string[]> {
  if (!ids?.length) {
    return [];
  }
  const members = new Set((await listMembers(db, orgId)).map((m) => m.userId));
  return [...new Set(ids)].filter((id) => members.has(id));
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

const clientId = z.string().uuid().optional();

export async function addComment(db: Db, input: NewComment): Promise<{ outcome: CommentOutcome; id?: string }> {
  if (commentBodyError(input.body) || !input.actor.id || !clientId.safeParse(input.id).success) {
    return { outcome: CommentOutcome.Invalid };
  }
  if (!(await pinTarget(db, input))) {
    return { outcome: CommentOutcome.Missing };
  }

  const { data, error } = await comments(db)
    .insert({ ...(input.id ? { id: input.id } : {}), org_id: input.orgId, canvas_id: input.canvasId, node_id: input.parentId ? null : (input.nodeId ?? null), parent_id: input.parentId ?? null, author_id: input.actor.id, x: input.x ?? 0, y: input.y ?? 0, time_ms: input.parentId ? null : momentOf(input.timeMs), mentions: input.byAgent ? [AGENT_MENTION_ID] : await mentionable(db, input.orgId, input.mentions), body: input.body.trim() })
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

type Authored = Scope & { commentId: string; actor: Actor };

export async function editComment(db: Db, input: Authored & { body: string; mentions?: string[] }): Promise<CommentOutcome> {
  if (commentBodyError(input.body) || !input.actor.id) {
    return CommentOutcome.Invalid;
  }

  const { data, error } = await comments(db)
    .update({ body: input.body.trim(), mentions: await mentionable(db, input.orgId, input.mentions), edited_at: new Date().toISOString() })
    .eq('org_id', input.orgId)
    .eq('canvas_id', input.canvasId)
    .eq('id', input.commentId)
    .eq('author_id', input.actor.id)
    .is('deleted_at', null)
    .select('id');
  if (error) {
    throw error;
  }
  return data?.length ? CommentOutcome.Added : CommentOutcome.Missing;
}

export async function deleteComment(db: Db, input: Authored): Promise<CommentOutcome> {
  if (!input.actor.id) {
    return CommentOutcome.Invalid;
  }

  const { data, error } = await comments(db)
    .update({ deleted_at: new Date().toISOString() })
    .eq('org_id', input.orgId)
    .eq('canvas_id', input.canvasId)
    .eq('id', input.commentId)
    .eq('author_id', input.actor.id)
    .is('deleted_at', null)
    .select('id');
  if (error) {
    throw error;
  }
  return data?.length ? CommentOutcome.Added : CommentOutcome.Missing;
}
