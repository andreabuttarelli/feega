import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { CommentOutcome, addComment, listComments, resolveThread } from './canvas-comments';

const scope = { orgId: 'org', canvasId: 'c' };
const user = { kind: 'user' as const, id: 'u1' };
const stored = (id: string, over: Record<string, unknown> = {}) => ({ id, org_id: 'org', canvas_id: 'c', node_id: null, parent_id: null, author_id: 'u1', x: 5, y: 6, body: id, resolved_at: null, created_at: `2026-10-23T10:00:0${id.length}Z`, deleted_at: null, ...over });
const open = (rows: Record<string, unknown>[] = []) => fakeDb({ canvas_comments: rows, nodes: [{ id: 'n1', org_id: 'org', canvas_id: 'c', deleted_at: null }] }, { filter: true, store: true, mutate: true });

describe('canvas comments', () => {
  it('a comment pinned to a frame is stored against that frame, written by the user', async () => {
    const fake = open();

    const out = await addComment(fake.db, { ...scope, nodeId: 'n1', x: 12, y: 34, body: ' tighten the headline ', actor: user });

    expect(out.outcome).toBe(CommentOutcome.Added);
    const insert = fake.calls.find((c) => c.table === 'canvas_comments' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ org_id: 'org', canvas_id: 'c', node_id: 'n1', x: 12, y: 34, body: 'tighten the headline', author_id: 'u1', parent_id: null });
  });

  it('a reply joins an existing thread on the same canvas', async () => {
    const fake = open([stored('a')]);

    const out = await addComment(fake.db, { ...scope, parentId: 'a', body: 'done', actor: user });

    expect(out.outcome).toBe(CommentOutcome.Added);
    expect((await listComments(fake.db, scope))[0].replies.map((r) => r.body)).toEqual(['done']);
  });

  it('refuses a reply to a thread that is not there', async () => {
    const out = await addComment(open().db, { ...scope, parentId: 'ghost', body: 'hi', actor: user });

    expect(out.outcome).toBe(CommentOutcome.Missing);
  });

  it('refuses an empty comment and a comment from nobody', async () => {
    expect((await addComment(open().db, { ...scope, body: '   ', actor: user })).outcome).toBe(CommentOutcome.Invalid);
    expect((await addComment(open().db, { ...scope, body: 'hi', actor: { kind: 'system', id: null } })).outcome).toBe(CommentOutcome.Invalid);
  });

  it('resolving stamps the thread, reopening clears it', async () => {
    const fake = open([stored('a')]);

    await resolveThread(fake.db, { ...scope, commentId: 'a', resolved: true });
    expect((await listComments(fake.db, scope))[0].resolved).toBe(true);

    await resolveThread(fake.db, { ...scope, commentId: 'a', resolved: false });
    expect((await listComments(fake.db, scope))[0].resolved).toBe(false);
  });

  it('lists threads of this canvas only, leaving out soft-deleted comments', async () => {
    const fake = open([stored('a'), stored('b', { canvas_id: 'other' }), stored('cc', { deleted_at: '2026-10-23' })]);

    expect((await listComments(fake.db, scope)).map((t) => t.id)).toEqual(['a']);
  });
});
