import { restoreRows, type OptimisticOp } from './optimistic-ops';
import type { CommentReply, CommentThread } from './comment-threads';

export enum CommentAction {
  Add = 'add',
  Reply = 'reply',
  Edit = 'edit',
  Delete = 'delete',
  Resolve = 'resolve'
}

export type CommentFields = Record<string, string | string[]>;
export type CommentContext = { me: string; now: () => string };
export type CommentPin = { nodeId: string | null; x: number; y: number; timeMs?: number };
type Answer = Record<string, unknown>;
type Threads = CommentThread[];

type Inputs = {
  [CommentAction.Add]: { id: string; body: string; at: CommentPin; mentions: string[] };
  [CommentAction.Reply]: { id: string; threadId: string; body: string; mentions: string[] };
  [CommentAction.Edit]: { commentId: string; body: string; mentions: string[] };
  [CommentAction.Delete]: { commentId: string };
  [CommentAction.Resolve]: { threadId: string; resolved: boolean };
};

type Row<I> = {
  action: string;
  fields: (input: I) => CommentFields;
  apply: (threads: Threads, input: I, ctx: CommentContext) => Threads;
  thread: (input: I, threads: Threads) => string;
  notice: string;
};

const holderOf = (threads: Threads, commentId: string): string =>
  threads.find((t) => t.id === commentId || t.replies.some((r) => r.id === commentId))?.id ?? commentId;

const onThread = (threads: Threads, id: string, change: (t: CommentThread) => CommentThread): Threads => threads.map((t) => (t.id === id ? change(t) : t));

function edited(threads: Threads, commentId: string, body: string, at: string): Threads {
  const rewrite = <C extends CommentReply>(c: C): C => (c.id === commentId ? { ...c, body: body.trim(), editedAt: at } : c);
  return threads.map((t) => ({ ...rewrite(t), replies: t.replies.map(rewrite) }));
}

const REGISTRY: { [K in CommentAction]: Row<Inputs[K]> } = {
  [CommentAction.Add]: {
    action: 'addComment',
    fields: (i) => ({
      id: i.id,
      body: i.body,
      x: String(i.at.x),
      y: String(i.at.y),
      ...(i.at.nodeId ? { node_id: i.at.nodeId } : {}),
      ...(i.at.timeMs === undefined ? {} : { time_ms: String(i.at.timeMs) }),
      mention: i.mentions
    }),
    apply: (threads, i, ctx) => [
      ...threads,
      { id: i.id, nodeId: i.at.nodeId, authorId: ctx.me, x: i.at.x, y: i.at.y, body: i.body.trim(), timeMs: i.at.timeMs ?? null, mentions: i.mentions, editedAt: null, createdAt: ctx.now(), number: threads.length + 1, resolved: false, replies: [] }
    ],
    thread: (i) => i.id,
    notice: 'Your comment did not save and was removed.'
  },
  [CommentAction.Reply]: {
    action: 'addComment',
    fields: (i) => ({ id: i.id, parent_id: i.threadId, body: i.body, mention: i.mentions }),
    apply: (threads, i, ctx) =>
      onThread(threads, i.threadId, (t) => ({ ...t, replies: [...t.replies, { id: i.id, authorId: ctx.me, body: i.body.trim(), mentions: i.mentions, editedAt: null, createdAt: ctx.now() }] })),
    thread: (i) => i.threadId,
    notice: 'Your reply did not save and was removed.'
  },
  [CommentAction.Edit]: {
    action: 'editComment',
    fields: (i) => ({ comment_id: i.commentId, body: i.body, mention: i.mentions }),
    apply: (threads, i, ctx) => edited(threads, i.commentId, i.body, ctx.now()),
    thread: (i, threads) => holderOf(threads, i.commentId),
    notice: 'The edit did not save and was undone.'
  },
  [CommentAction.Delete]: {
    action: 'deleteComment',
    fields: (i) => ({ comment_id: i.commentId }),
    apply: (threads, i) => threads.filter((t) => t.id !== i.commentId).map((t) => ({ ...t, replies: t.replies.filter((r) => r.id !== i.commentId) })),
    thread: (i, threads) => holderOf(threads, i.commentId),
    notice: 'Delete did not save; the comment is back.'
  },
  [CommentAction.Resolve]: {
    action: 'resolveComment',
    fields: (i) => ({ comment_id: i.threadId, resolved: i.resolved ? '1' : '0' }),
    apply: (threads, i) => onThread(threads, i.threadId, (t) => ({ ...t, resolved: i.resolved })),
    thread: (i) => i.threadId,
    notice: 'Resolving did not save and was undone.'
  }
};

export type CommentOp = { action: string; fields: CommentFields; apply: (threads: Threads) => Threads; touched: string[]; notice: string };

export function commentOp<K extends CommentAction>(action: K, input: Inputs[K], before: Threads, ctx: CommentContext): CommentOp {
  const row = REGISTRY[action] as Row<Inputs[K]>;
  return {
    action: row.action,
    fields: row.fields(input),
    apply: (threads) => row.apply(threads, input, ctx),
    touched: [row.thread(input, before)],
    notice: row.notice
  };
}

export const restoreThreads = (current: Threads, before: Threads, touched: readonly string[]): Threads => restoreRows(current, before, touched);

export function runnable(op: CommentOp, post: (action: string, fields: CommentFields) => Promise<Answer | null>): OptimisticOp<Threads, Answer, readonly string[]> {
  return { apply: op.apply, touched: op.touched, send: () => post(op.action, op.fields), undo: () => [], notice: op.notice };
}
