import { describe, expect, it } from 'vitest';
import { ToView, type ViewMessage } from '../messages';
import { commentsHost, type CommentsCloud } from './comments';
import type { CloudComment, CloudRevisions, CommentDraft } from './cloud-api';
import type { ChangeRow } from '../messages';

const comment = (id: string): CloudComment => ({ id, sessionId: 's1', authorId: 'u1', authorName: 'Ada', body: 'Tighter', selector: 'div', sourceFile: 'a.svelte', sourceLine: 1, sourceCol: 1, parentId: null, createdAt: '2026-11-21T10:00:00Z', resolvedAt: null, resolvedBy: null });

const row = (id: number, file: string): ChangeRow => ({ id, at: `${file}:1:1`, prop: 'padding', value: '24px', scope: 'all', files: [file], time: id });

const OPEN: CloudRevisions = { status: 'open', revisions: [] };

const rig = (session: string | null = 's1', revisions: CloudRevisions = OPEN) => {
  const posted: ViewMessage[] = [];
  const calls: string[] = [];
  const stored = [comment('c1')];
  const failing = { next: null as Error | null };
  const guard = () => {
    if (failing.next) {
      throw failing.next;
    }
  };
  const cloud: CommentsCloud = {
    sessionId: () => session,
    api: {
      comments: async (id, openOnly) => (calls.push(`list ${id} ${openOnly}`), guard(), stored),
      addComment: async (id, draft: CommentDraft) => (calls.push(`add ${id} ${draft.body}`), guard(), stored.push(comment('c2')), comment('c2')),
      revisions: async (id) => (calls.push(`revisions ${id}`), guard(), revisions),
      publishRevision: async (id, summary, changes) => (calls.push(`publish ${id} ${summary} ${changes.map((c) => `${c.file}|${c.prop}|${c.value}`).join(',')}`), guard(), { id: 'r1', number: 1 }),
      resolve: async (id, commentId, note) => (calls.push(`resolve ${id} ${commentId} ${note ?? ''}`.trim()), guard(), comment(commentId))
    }
  };
  return { posted, calls, failing, host: commentsHost(cloud, (m) => void posted.push(m), () => [row(1, 'src/a.svelte'), row(2, 'src/b.svelte')]), none: commentsHost(undefined, (m) => void posted.push(m), () => []) };
};

const draft: CommentDraft = { body: 'Bigger', selector: 'button', sourceFile: 'a.svelte', sourceLine: 2, sourceCol: 3 };

describe('comments host', () => {
  it('disables comments when there is no cloud', async () => {
    const { none, posted } = rig();

    await none.show();

    expect(posted).toEqual([{ kind: ToView.Comments, enabled: false, comments: [] }]);
  });

  it('disables comments when no session is shared', async () => {
    const { host, posted, calls } = rig(null);

    await host.show();

    expect(posted).toEqual([{ kind: ToView.Comments, enabled: false, comments: [] }]);
    expect(calls).toEqual([]);
  });

  it('lists every comment of the session, resolved ones included', async () => {
    const { host, posted, calls } = rig();

    await host.show();

    expect(calls).toEqual(['list s1 false', 'revisions s1']);
    expect(posted).toEqual([{ kind: ToView.Comments, enabled: true, comments: [comment('c1')], review: OPEN }]);
  });

  it('adds a comment, then shows the refreshed list', async () => {
    const { host, posted, calls } = rig();

    await host.add(draft);

    expect(calls).toEqual(['add s1 Bigger', 'list s1 false', 'revisions s1']);
    expect((posted[0] as { comments: CloudComment[] }).comments.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('resolves a comment, then shows the refreshed list', async () => {
    const { host, calls } = rig();

    await host.resolve('c1');

    expect(calls).toEqual(['resolve s1 c1', 'list s1 false', 'revisions s1']);
  });

  it('keeps the last list and says why when the cloud fails', async () => {
    const { host, posted, failing } = rig();
    await host.show();
    failing.next = new Error('Feega Cloud needs a paid plan');

    await host.add(draft);

    expect(posted.at(-1)).toEqual({ kind: ToView.Comments, enabled: true, comments: [comment('c1')], review: OPEN, error: 'Feega Cloud needs a paid plan' });
  });

  it('publishes the editor changes as a revision, then shows the new round', async () => {
    const { host, calls } = rig();

    await host.publish('Round one');

    expect(calls).toEqual(['publish s1 Round one src/a.svelte|padding|24px,src/b.svelte|padding|24px', 'list s1 false', 'revisions s1']);
  });

  it('shows the verdicts of the latest round', async () => {
    const review: CloudRevisions = { status: 'changes_requested', revisions: [{ id: 'r1', sessionId: 's1', number: 1, authorId: 'host', summary: 'Round one', changes: [], createdAt: '2026-11-21T10:00:00Z', status: 'changes_requested', verdicts: [{ reviewerId: 'u2', reviewerName: 'Vera', verdict: 'changes_requested', note: 'Tighter', decidedAt: '2026-11-21T10:30:00Z' }] }] };
    const { host, posted } = rig('s1', review);

    await host.show();

    expect((posted[0] as { review: CloudRevisions }).review.status).toBe('changes_requested');
  });
});
