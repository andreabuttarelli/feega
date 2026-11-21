import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionRow, SessionRole } from './sessions';

export type Comment = {
  id: string;
  sessionId: string;
  authorId: string;
  authorName: string;
  body: string;
  selector: string;
  sourceFile: string;
  sourceLine: number;
  sourceCol: number;
  parentId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

export type CommentInput = {
  body: string;
  selector: string;
  sourceFile: string;
  sourceLine: number;
  sourceCol: number;
  parentId: string | null;
};

export enum CommentCheck {
  Valid = 'valid',
  BadBody = 'bad_body',
  BadSelector = 'bad_selector',
  BadSourceFile = 'bad_source_file',
  BadPosition = 'bad_position'
}

export enum ResolveOutcome {
  Resolved = 'resolved',
  NotFound = 'not_found',
  Forbidden = 'forbidden'
}

const BODY_MAX_CHARS = 2000;
const SELECTOR_MAX_CHARS = 1000;
const FILE_MAX_CHARS = 1000;
const ABSOLUTE_PATH = /^([/\\]|[a-zA-Z]:)/;
const PARENT_SEGMENT = /(^|[/\\])\.\.([/\\]|$)/;
const EDIT_ROLES: readonly SessionRole[] = ['host', 'editor'];

type Row = {
  id: string;
  session_id: string;
  author_id: string;
  author_name: string;
  body: string;
  selector: string;
  source_file: string;
  source_line: number;
  source_col: number;
  parent_id: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

function failure(error: { message: string }): Error {
  return new Error(`cloud comments: ${error.message}`);
}

function isCount(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0;
}

export function toComment(row: Row): Comment {
  return {
    id: row.id,
    sessionId: row.session_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    selector: row.selector,
    sourceFile: row.source_file,
    sourceLine: row.source_line,
    sourceCol: row.source_col,
    parentId: row.parent_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolved_by ?? null
  };
}

export function readCommentInput(raw: unknown): { check: CommentCheck.Valid; input: CommentInput } | { check: Exclude<CommentCheck, CommentCheck.Valid> } {
  const body = (raw ?? {}) as Record<string, unknown>;
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  const selector = typeof body.selector === 'string' ? body.selector : '';
  const sourceFile = typeof body.sourceFile === 'string' ? body.sourceFile : '';

  if (!text || text.length > BODY_MAX_CHARS) {
    return { check: CommentCheck.BadBody };
  }
  if (!selector || selector.length > SELECTOR_MAX_CHARS) {
    return { check: CommentCheck.BadSelector };
  }
  if (!sourceFile || sourceFile.length > FILE_MAX_CHARS || ABSOLUTE_PATH.test(sourceFile) || PARENT_SEGMENT.test(sourceFile)) {
    return { check: CommentCheck.BadSourceFile };
  }
  if (!isCount(body.sourceLine) || !isCount(body.sourceCol)) {
    return { check: CommentCheck.BadPosition };
  }

  return {
    check: CommentCheck.Valid,
    input: {
      body: text,
      selector,
      sourceFile,
      sourceLine: body.sourceLine as number,
      sourceCol: body.sourceCol as number,
      parentId: typeof body.parentId === 'string' && body.parentId ? body.parentId : null
    }
  };
}

export async function listComments(db: SupabaseClient, sessionId: string, openOnly: boolean): Promise<Comment[]> {
  const query = db.from('share_comments').select('*').eq('session_id', sessionId);
  const { data, error } = await (openOnly ? query.is('resolved_at', null) : query).order('created_at', { ascending: true });
  if (error) {
    throw failure(error);
  }

  return ((data ?? []) as Row[]).map(toComment);
}

export async function addComment(db: SupabaseClient, session: SessionRow, author: { id: string; name: string }, input: CommentInput): Promise<Comment> {
  const { data, error } = await db
    .from('share_comments')
    .insert({
      session_id: session.id,
      org_id: session.org_id,
      author_id: author.id,
      author_name: author.name,
      body: input.body,
      selector: input.selector,
      source_file: input.sourceFile,
      source_line: input.sourceLine,
      source_col: input.sourceCol,
      parent_id: input.parentId
    })
    .select('*')
    .single();
  if (error || !data) {
    throw failure(error ?? { message: 'comment not created' });
  }

  return toComment(data as Row);
}

export async function resolveComment(
  db: SupabaseClient,
  session: SessionRow,
  commentId: string,
  resolver: { id: string; role: SessionRole },
  note: string | null,
  now: Date
): Promise<{ outcome: ResolveOutcome.Resolved; comment: Comment } | { outcome: ResolveOutcome.NotFound }
  | { outcome: ResolveOutcome.Forbidden }
> {
  const { data } = await db.from('share_comments').select('*').eq('id', commentId).eq('session_id', session.id).maybeSingle();
  const existing = data as Row | null;
  if (!existing) {
    return { outcome: ResolveOutcome.NotFound };
  }
  if (existing.author_id !== resolver.id && !EDIT_ROLES.includes(resolver.role)) {
    return { outcome: ResolveOutcome.Forbidden };
  }

  const patch = { resolved_at: existing.resolved_at ?? now.toISOString(), resolved_by: existing.resolved_by ?? resolver.id, resolve_note: note };
  const { data: updated, error } = await db.from('share_comments').update(patch).eq('id', commentId).select('*').single();
  if (error || !updated) {
    throw failure(error ?? { message: 'comment not updated' });
  }

  return { outcome: ResolveOutcome.Resolved, comment: toComment(updated as Row) };
}
