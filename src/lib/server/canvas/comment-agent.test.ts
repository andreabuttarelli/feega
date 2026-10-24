import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { AGENT_MENTION_ID } from '$lib/canvas/comment-agent';
import { answerMention, MentionOutcome, type CommentAgent } from './comment-agent';

const base = { orgId: 'org', projectId: 'p', canvasId: 'c', userId: 'u1', commentId: 'k1', parentId: null, nodeId: 'n1', body: '@feega make this darker' };
const root = { id: 'k1', org_id: 'org', canvas_id: 'c', node_id: 'n1', parent_id: null, author_id: 'u1', body: '', mentions: [], deleted_at: null };
const open = (rows: Record<string, unknown>[] = [root]) => fakeDb({ canvas_comments: rows, nodes: [{ id: 'n1', org_id: 'org', canvas_id: 'c', deleted_at: null }], orgs_members: [] }, { filter: true, store: true });
const answers = (text: string): CommentAgent => vi.fn(async () => ({ ok: true as const, text }));
const replies = (calls: ReturnType<typeof open>['calls']) => calls.filter((c) => c.table === 'canvas_comments' && c.op === 'insert').map((c) => c.payload as Record<string, unknown>);

describe('a comment that calls @feega', () => {
  it('runs the agent on the pinned node with the comment as the instruction', async () => {
    const fake = open();
    const agent = answers('Made it darker.');

    const outcome = await answerMention({ db: fake.db, agent }, base);

    expect(outcome).toBe(MentionOutcome.Answered);
    expect(agent).toHaveBeenCalledWith(expect.objectContaining({ nodeIds: ['n1'], canvasId: 'c', projectId: 'p', prompt: expect.stringContaining('make this darker') }));
  });

  it('answers in the same thread, written as the commenter and marked as the agent', async () => {
    const fake = open();

    await answerMention({ db: fake.db, agent: answers('Made it darker.') }, base);

    expect(replies(fake.calls)).toEqual([expect.objectContaining({ parent_id: 'k1', author_id: 'u1', body: 'Made it darker.', mentions: [AGENT_MENTION_ID], org_id: 'org' })]);
  });

  it('a reply in a thread acts on the node the thread is pinned to', async () => {
    const fake = open();
    const agent = answers('ok');

    await answerMention({ db: fake.db, agent }, { ...base, commentId: 'k2', parentId: 'k1', nodeId: null });

    expect(agent).toHaveBeenCalledWith(expect.objectContaining({ nodeIds: ['n1'] }));
    expect(replies(fake.calls)[0]).toMatchObject({ parent_id: 'k1' });
  });

  it('a comment that does not call it never reaches the agent', async () => {
    const fake = open();
    const agent = answers('x');

    const outcome = await answerMention({ db: fake.db, agent }, { ...base, body: 'looks good' });

    expect(outcome).toBe(MentionOutcome.Ignored);
    expect(agent).not.toHaveBeenCalled();
    expect(replies(fake.calls)).toEqual([]);
  });

  it('a refused run is told in the thread instead of staying silent', async () => {
    const fake = open();
    const agent: CommentAgent = async () => ({ ok: false, message: 'out of credits' });

    const outcome = await answerMention({ db: fake.db, agent }, base);

    expect(outcome).toBe(MentionOutcome.Failed);
    expect(replies(fake.calls)[0]).toMatchObject({ body: expect.stringContaining('out of credits'), mentions: [AGENT_MENTION_ID] });
  });

  it('an agent that throws is told in the thread too', async () => {
    const fake = open();
    const agent: CommentAgent = async () => {
      throw new Error('boom');
    };

    expect(await answerMention({ db: fake.db, agent }, base)).toBe(MentionOutcome.Failed);
    expect(replies(fake.calls)).toHaveLength(1);
  });
});
