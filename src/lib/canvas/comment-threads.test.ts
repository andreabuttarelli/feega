import { describe, expect, it } from 'vitest';
import { commentBodyError, threadsOf, type CommentRow } from './comment-threads';

const row = (id: string, at: number, over: Partial<CommentRow> = {}): CommentRow => ({
  id,
  nodeId: null,
  parentId: null,
  authorId: 'u1',
  x: 10,
  y: 20,
  body: id,
  resolvedAt: null,
  createdAt: new Date(at).toISOString(),
  ...over
});

describe('comment threads', () => {
  it('numbers pins in the order they were dropped and nests replies oldest first', () => {
    const threads = threadsOf([row('r2', 5, { parentId: 'b' }), row('b', 2), row('a', 1), row('r1', 3, { parentId: 'b' })]);

    expect(threads.map((t) => [t.id, t.number])).toEqual([['a', 1], ['b', 2]]);
    expect(threads[1].replies.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('a thread is resolved when its first comment is', () => {
    const [thread] = threadsOf([row('a', 1, { resolvedAt: new Date(9).toISOString() })]);

    expect(thread.resolved).toBe(true);
  });

  it('keeps the pin where it was dropped, on a node or on the canvas', () => {
    const [onNode, onCanvas] = threadsOf([row('a', 1, { nodeId: 'n1', x: 4, y: 6 }), row('b', 2)]);

    expect([onNode.nodeId, onNode.x, onNode.y]).toEqual(['n1', 4, 6]);
    expect(onCanvas.nodeId).toBeNull();
  });

  it('drops a reply whose thread is gone', () => {
    expect(threadsOf([row('r', 1, { parentId: 'missing' })])).toEqual([]);
  });

  it('refuses an empty or too long body', () => {
    expect(commentBodyError('  ')).not.toBeNull();
    expect(commentBodyError('x'.repeat(2001))).not.toBeNull();
    expect(commentBodyError('hello')).toBeNull();
  });
});
