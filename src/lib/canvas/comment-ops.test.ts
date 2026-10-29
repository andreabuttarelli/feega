import { describe, expect, it } from 'vitest';
import { CommentAction, commentOp, restoreThreads } from './comment-ops';
import type { CommentThread } from './comment-threads';

const NOW = '2026-10-29T12:00:00.000Z';
const ctx = { me: 'u1', now: () => NOW };

const thread = (id: string, number: number, replies: CommentThread['replies'] = []): CommentThread => ({
  id,
  nodeId: null,
  authorId: 'u1',
  x: 0,
  y: 0,
  body: `body ${id}`,
  timeMs: null,
  mentions: [],
  editedAt: null,
  createdAt: '2026-10-28T10:00:00.000Z',
  number,
  resolved: false,
  replies
});

const reply = (id: string) => ({ id, authorId: 'u1', body: `reply ${id}`, mentions: [], editedAt: null, createdAt: '2026-10-28T11:00:00.000Z' });

describe('comment ops: a comment shows the moment it is sent', () => {
  it('adds a numbered thread under the client id, by me, before any answer', () => {
    const before = [thread('t1', 1)];
    const op = commentOp(CommentAction.Add, { id: 'c9', body: '  hello  ', at: { nodeId: 'n1', x: 4, y: 5, timeMs: 1200 }, mentions: ['u2'] }, before, ctx);

    const after = op.apply(before);

    expect(after.at(-1)).toEqual({ id: 'c9', nodeId: 'n1', authorId: 'u1', x: 4, y: 5, body: 'hello', timeMs: 1200, mentions: ['u2'], editedAt: null, createdAt: NOW, number: 2, resolved: false, replies: [] });
    expect(op.fields).toEqual({ id: 'c9', body: '  hello  ', x: '4', y: '5', node_id: 'n1', time_ms: '1200', mention: ['u2'] });
    expect(op.touched).toEqual(['c9']);
  });

  it('appends a reply to its thread', () => {
    const before = [thread('t1', 1)];
    const op = commentOp(CommentAction.Reply, { id: 'r1', threadId: 't1', body: 'yes', mentions: [] }, before, ctx);

    expect(op.apply(before)[0].replies).toEqual([{ id: 'r1', authorId: 'u1', body: 'yes', mentions: [], editedAt: null, createdAt: NOW }]);
    expect(op.fields).toEqual({ id: 'r1', parent_id: 't1', body: 'yes', mention: [] });
    expect(op.touched).toEqual(['t1']);
  });

  it('edits a reply in place and marks it edited', () => {
    const before = [thread('t1', 1, [reply('r1')])];
    const op = commentOp(CommentAction.Edit, { commentId: 'r1', body: 'changed', mentions: [] }, before, ctx);

    expect(op.apply(before)[0].replies[0]).toMatchObject({ body: 'changed', editedAt: NOW });
    expect(op.touched).toEqual(['t1']);
  });

  it('deletes a root thread, or only the reply', () => {
    const before = [thread('t1', 1, [reply('r1')]), thread('t2', 2)];

    expect(commentOp(CommentAction.Delete, { commentId: 't2' }, before, ctx).apply(before).map((t) => t.id)).toEqual(['t1']);
    expect(commentOp(CommentAction.Delete, { commentId: 'r1' }, before, ctx).apply(before)[0].replies).toEqual([]);
  });

  it('toggles resolved and sends the new state', () => {
    const before = [thread('t1', 1)];
    const op = commentOp(CommentAction.Resolve, { threadId: 't1', resolved: true }, before, ctx);

    expect(op.apply(before)[0].resolved).toBe(true);
    expect(op.fields).toEqual({ comment_id: 't1', resolved: '1' });
  });

  it('a refusal puts back only the threads the op touched', () => {
    const before = [thread('t1', 1), thread('t2', 2)];
    const op = commentOp(CommentAction.Resolve, { threadId: 't1', resolved: true }, before, ctx);
    const meanwhile = op.apply(before).map((t) => (t.id === 't2' ? { ...t, body: 'peer edit' } : t));

    expect(restoreThreads(meanwhile, before, op.touched)).toEqual([thread('t1', 1), { ...thread('t2', 2), body: 'peer edit' }]);
  });
});
