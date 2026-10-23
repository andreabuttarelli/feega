export const COMMENT_BODY_MAX = 2000;

export type CommentRow = {
  id: string;
  nodeId: string | null;
  parentId: string | null;
  authorId: string;
  x: number;
  y: number;
  body: string;
  resolvedAt: string | null;
  timeMs: number | null;
  mentions: string[];
  editedAt: string | null;
  createdAt: string;
};

export type CommentReply = Pick<CommentRow, 'id' | 'authorId' | 'body' | 'mentions' | 'editedAt' | 'createdAt'>;

export type CommentThread = Omit<CommentRow, 'parentId' | 'resolvedAt'> & { number: number; resolved: boolean; replies: CommentReply[] };

const byAge = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);

export function commentBodyError(body: string): string | null {
  const length = body.trim().length;
  if (length === 0) {
    return 'Write something first';
  }
  return length > COMMENT_BODY_MAX ? `Keep it under ${COMMENT_BODY_MAX} characters` : null;
}

export function threadsOf(rows: CommentRow[]): CommentThread[] {
  const roots = rows.filter((r) => !r.parentId).sort(byAge);
  const replies = rows.filter((r) => r.parentId).sort(byAge);

  return roots.map(({ parentId: _parent, resolvedAt, ...root }, i) => ({
    ...root,
    number: i + 1,
    resolved: resolvedAt !== null,
    replies: replies.filter((r) => r.parentId === root.id).map(({ id, authorId, body, mentions, editedAt, createdAt }) => ({ id, authorId, body, mentions, editedAt, createdAt }))
  }));
}
