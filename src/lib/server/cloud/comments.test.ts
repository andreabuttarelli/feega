import { describe, expect, it } from 'vitest';
import { addComment, CommentCheck, listComments, readCommentInput, resolveComment, ResolveOutcome } from './comments';
import type { SessionRow } from './sessions';
import { fakeDb } from './testing/fake-db';

const NOW = new Date('2026-11-21T10:00:00Z');
const SESSION: SessionRow = {
  id: 'abcdefghij',
  org_id: 'org-1',
  project_id: 'proj-1',
  host_user_id: 'host-1',
  project_name: 'Landing',
  visitor_role: 'editor',
  status: 'live',
  started_at: NOW.toISOString(),
  closed_at: null,
  expires_at: '2026-11-21T22:00:00Z',
  snapshot_path: null
};
const VALID = { body: ' Tighten this ', selector: 'main > h1', sourceFile: 'src/Hero.tsx', sourceLine: 12, sourceCol: 4 };

function stored(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    session_id: SESSION.id,
    org_id: SESSION.org_id,
    author_id: 'ada',
    author_name: 'Ada',
    body: 'b',
    selector: 's',
    source_file: 'f.ts',
    source_line: 1,
    source_col: 1,
    parent_id: null,
    created_at: '2026-11-21T10:00:00Z',
    resolved_at: null,
    resolved_by: null,
    ...over
  };
}

describe('readCommentInput', () => {
  it('trims the body and accepts a relative source file', () => {
    expect(readCommentInput(VALID)).toEqual({ check: CommentCheck.Valid, input: { ...VALID, body: 'Tighten this', parentId: null, revisionId: null } });
  });

  it.each([
    [{ ...VALID, body: '  ' }, CommentCheck.BadBody],
    [{ ...VALID, body: 'x'.repeat(2001) }, CommentCheck.BadBody],
    [{ ...VALID, selector: '' }, CommentCheck.BadSelector],
    [{ ...VALID, sourceFile: '/Users/ada/app/src/Hero.tsx' }, CommentCheck.BadSourceFile],
    [{ ...VALID, sourceFile: 'C:\\app\\Hero.tsx' }, CommentCheck.BadSourceFile],
    [{ ...VALID, sourceFile: '../secrets.ts' }, CommentCheck.BadSourceFile],
    [{ ...VALID, sourceFile: 'src/../../x.ts' }, CommentCheck.BadSourceFile],
    [{ ...VALID, sourceLine: -1 }, CommentCheck.BadPosition],
    [{ ...VALID, sourceCol: 1.5 }, CommentCheck.BadPosition],
    [null, CommentCheck.BadBody]
  ])('rejects %j', (input, check) => {
    expect(readCommentInput(input)).toEqual({ check });
  });
});

describe('addComment and listComments', () => {
  it('stores the author, the session org and the source position, and returns the contract shape', async () => {
    const db = fakeDb();
    const read = readCommentInput(VALID);
    if (read.check !== CommentCheck.Valid) {
      throw new Error('unexpected');
    }

    const comment = await addComment(db, SESSION, { id: 'ada', name: 'Ada' }, read.input);

    expect(comment).toMatchObject({ sessionId: 'abcdefghij', authorId: 'ada', authorName: 'Ada', body: 'Tighten this', sourceFile: 'src/Hero.tsx', sourceLine: 12, sourceCol: 4, parentId: null, resolvedAt: null, resolvedBy: null });
    expect(db.tables.share_comments[0].org_id).toBe('org-1');
  });

  it('lists only the open comments of the session when asked', async () => {
    const db = fakeDb({
      share_comments: [stored({ id: 'open' }), stored({ id: 'done', resolved_at: '2026-11-21T11:00:00Z' }), stored({ id: 'other', session_id: 'zzzzzzzzzz' })]
    });

    expect((await listComments(db, SESSION.id, true)).map((c) => c.id)).toEqual(['open']);
    expect((await listComments(db, SESSION.id, false)).map((c) => c.id)).toEqual(['open', 'done']);
  });
});

describe('resolveComment', () => {
  it('lets an editor resolve and records who and when', async () => {
    const db = fakeDb({ share_comments: [stored()] });

    const result = await resolveComment(db, SESSION, 'c1', { id: 'bob', role: 'editor' }, 'fixed', NOW);

    expect(result).toMatchObject({ outcome: ResolveOutcome.Resolved, comment: { resolvedAt: NOW.toISOString(), resolvedBy: 'bob' } });
    expect(db.tables.share_comments[0].resolve_note).toBe('fixed');
  });

  it('lets the author resolve their own comment even as a viewer', async () => {
    const db = fakeDb({ share_comments: [stored()] });

    const result = await resolveComment(db, SESSION, 'c1', { id: 'ada', role: 'viewer' }, null, NOW);

    expect(result.outcome).toBe(ResolveOutcome.Resolved);
  });

  it('refuses a viewer who is not the author', async () => {
    const db = fakeDb({ share_comments: [stored()] });

    const result = await resolveComment(db, SESSION, 'c1', { id: 'eve', role: 'viewer' }, null, NOW);

    expect(result.outcome).toBe(ResolveOutcome.Forbidden);
    expect(db.tables.share_comments[0].resolved_at).toBeNull();
  });

  it('keeps the first resolution when resolved twice', async () => {
    const db = fakeDb({ share_comments: [stored({ resolved_at: '2026-11-20T00:00:00Z', resolved_by: 'host-1' })] });

    const result = await resolveComment(db, SESSION, 'c1', { id: 'bob', role: 'editor' }, null, NOW);

    expect(result).toMatchObject({ comment: { resolvedAt: '2026-11-20T00:00:00Z', resolvedBy: 'host-1' } });
  });

  it('does not reach a comment of another session', async () => {
    const db = fakeDb({ share_comments: [stored({ session_id: 'zzzzzzzzzz' })] });

    const result = await resolveComment(db, SESSION, 'c1', { id: 'host-1', role: 'host' }, null, NOW);

    expect(result.outcome).toBe(ResolveOutcome.NotFound);
  });
});
