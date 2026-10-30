import { describe, expect, it } from 'vitest';
import { AGENT_MENTION_ID } from '$lib/canvas/comment-agent';
import { fakeDb } from '$lib/server/db/fake-db';
import { CommentOutcome, addComment, deleteComment, editComment, listComments, resolveThread, teammates } from './canvas-comments';

const scope = { orgId: 'org', canvasId: 'c' };
const user = { kind: 'user' as const, id: 'u1' };
const stored = (id: string, over: Record<string, unknown> = {}) => ({ id, org_id: 'org', canvas_id: 'c', node_id: null, parent_id: null, author_id: 'u1', x: 5, y: 6, body: id, resolved_at: null, time_ms: null, edited_at: null, mentions: [], created_at: `2026-10-23T10:00:0${id.length}Z`, deleted_at: null, ...over });
const member = (userId: string, name: string, orgId = 'org') => ({ org_id: orgId, user_id: userId, role: 'editor', profiles: { email: `${name}@x.co`, name } });
const open = (rows: Record<string, unknown>[] = []) => fakeDb({ canvas_comments: rows, nodes: [{ id: 'n1', org_id: 'org', canvas_id: 'c', deleted_at: null }], orgs_members: [member('u1', 'Ana'), member('u2', 'Bo'), member('u9', 'Out', 'elsewhere')] }, { filter: true, store: true, mutate: true });

describe('canvas comments', () => {
  it('a comment pinned to a frame is stored against that frame, written by the user', async () => {
    const fake = open();

    const out = await addComment(fake.db, { ...scope, nodeId: 'n1', x: 12, y: 34, body: ' tighten the headline ', actor: user });

    expect(out.outcome).toBe(CommentOutcome.Added);
    const insert = fake.calls.find((c) => c.table === 'canvas_comments' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ org_id: 'org', canvas_id: 'c', node_id: 'n1', x: 12, y: 34, body: 'tighten the headline', author_id: 'u1', parent_id: null });
  });

  it('a comment keeps the id the client picked, so the one on screen is the one stored', async () => {
    const fake = open();
    const id = '0b6f4f53-3c55-4d4c-9a39-0f6c7a2b9e10';

    const out = await addComment(fake.db, { ...scope, id, body: 'hi', actor: user });

    expect(out).toEqual({ outcome: CommentOutcome.Added, id });
    expect(fake.calls.find((c) => c.table === 'canvas_comments' && c.op === 'insert')?.payload).toMatchObject({ id });
  });

  it('an id that is not a uuid is refused, not stored', async () => {
    expect((await addComment(open().db, { ...scope, id: 'not-a-uuid', body: 'hi', actor: user })).outcome).toBe(CommentOutcome.Invalid);
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

  it('a comment on a motion frame can carry the time it is about', async () => {
    const fake = open();

    await addComment(fake.db, { ...scope, nodeId: 'n1', timeMs: 1500, body: 'too slow here', actor: user });

    expect(fake.calls.find((c) => c.table === 'canvas_comments' && c.op === 'insert')?.payload).toMatchObject({ time_ms: 1500 });
    expect((await listComments(fake.db, scope))[0].timeMs).toBe(1500);
  });

  it('a time that is not a moment is dropped, not stored', async () => {
    const fake = open();

    await addComment(fake.db, { ...scope, nodeId: 'n1', timeMs: Number.NaN, body: 'when?', actor: user });

    expect(fake.calls.find((c) => c.table === 'canvas_comments' && c.op === 'insert')?.payload).toMatchObject({ time_ms: null });
  });

  it('keeps only mentions that are members of this org', async () => {
    const fake = open();

    await addComment(fake.db, { ...scope, mentions: ['u2', 'u9', 'ghost', 'u2'], body: '@Bo look', actor: user });

    expect(fake.calls.find((c) => c.table === 'canvas_comments' && c.op === 'insert')?.payload).toMatchObject({ mentions: ['u2'] });
  });

  it('the author edits a comment, which is marked as edited and re-reads its mentions', async () => {
    const fake = open([stored('a')]);

    const out = await editComment(fake.db, { ...scope, commentId: 'a', body: ' better ', mentions: ['u2'], actor: user });

    expect(out).toBe(CommentOutcome.Added);
    const [thread] = await listComments(fake.db, scope);
    expect(thread.body).toBe('better');
    expect(thread.mentions).toEqual(['u2']);
    expect(thread.editedAt).not.toBeNull();
  });

  it('nobody edits or deletes a comment somebody else wrote', async () => {
    const fake = open([stored('a')]);
    const other = { kind: 'user' as const, id: 'u2' };

    expect(await editComment(fake.db, { ...scope, commentId: 'a', body: 'mine now', actor: other })).toBe(CommentOutcome.Missing);
    expect(await deleteComment(fake.db, { ...scope, commentId: 'a', actor: other })).toBe(CommentOutcome.Missing);
    expect((await listComments(fake.db, scope))[0].body).toBe('a');
  });

  it('an edit that leaves the comment empty is refused', async () => {
    expect(await editComment(open([stored('a')]).db, { ...scope, commentId: 'a', body: '  ', actor: user })).toBe(CommentOutcome.Invalid);
  });

  it('the author deletes a reply, and the thread stays', async () => {
    const fake = open([stored('a'), stored('rr', { parent_id: 'a', created_at: '2026-10-23T11:00:00Z' })]);

    expect(await deleteComment(fake.db, { ...scope, commentId: 'rr', actor: user })).toBe(CommentOutcome.Added);

    const [thread] = await listComments(fake.db, scope);
    expect(thread.replies).toEqual([]);
  });

  it('deleting the first comment takes the whole thread away', async () => {
    const fake = open([stored('a'), stored('rr', { parent_id: 'a' })]);

    await deleteComment(fake.db, { ...scope, commentId: 'a', actor: user });

    expect(await listComments(fake.db, scope)).toEqual([]);
  });

  it('lists the teammates of the org to mention, by name, and the agent last', async () => {
    expect(await teammates(open().db, 'org')).toEqual([
      { id: 'u1', name: 'Ana' },
      { id: 'u2', name: 'Bo' },
      { id: AGENT_MENTION_ID, name: 'feega' }
    ]);
  });

  it('a person cannot pass for the agent by mentioning its marker', async () => {
    const fake = open();

    await addComment(fake.db, { ...scope, nodeId: 'n1', body: 'hi', actor: user, mentions: [AGENT_MENTION_ID, 'u2'] });

    expect(fake.calls.find((c) => c.table === 'canvas_comments' && c.op === 'insert')?.payload).toMatchObject({ mentions: ['u2'] });
  });
});
