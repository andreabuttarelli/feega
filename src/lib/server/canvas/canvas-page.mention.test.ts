import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { AGENT_MENTION_ID } from '$lib/canvas/comment-agent';

const state = vi.hoisted(() => ({ pending: [] as Promise<unknown>[], agent: vi.fn() }));

vi.mock('$lib/server/background-work', () => ({ runInBackground: (work: () => Promise<unknown>) => state.pending.push(work()) }));
vi.mock('$lib/server/canvas/comment-agent-http', () => ({ httpAgent: () => state.agent }));
vi.mock('$lib/server/repos/orgs', async (original) => ({ ...(await original<object>()), listMemberships: async () => [{ orgId: 'org' }], listMembers: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => ({ orgId: 'org', mode: 'standard', canvas: { id: 'c', projectId: 'p' }, projectBrandId: null }) }));

const { actions } = await import('./canvas-page');

const node = { id: 'n1', org_id: 'org', canvas_id: 'c', deleted_at: null };
const thread = (rows: Record<string, unknown>[] = []) => fakeDb({ canvas_comments: rows, nodes: [node], orgs_members: [] }, { filter: true, store: true });

function post(fake: ReturnType<typeof thread>, fields: Record<string, string>) {
  const body = new FormData();
  Object.entries(fields).forEach(([k, v]) => body.set(k, v));
  const locals = { safeGetSession: async () => ({ session: { access_token: 'jwt' }, user: { id: 'u1', created_at: '2026-01-01' } }), db: async () => fake.db };
  return (actions.addComment as (e: unknown) => Promise<unknown>)({ request: new Request('https://x.test', { method: 'POST', body }), params: { projectId: 'p', canvasId: 'c' }, locals, url: new URL('https://feega.test/p/p/c/c') });
}

const inserts = (fake: ReturnType<typeof thread>) => fake.calls.filter((c) => c.table === 'canvas_comments' && c.op === 'insert').map((c) => c.payload as Record<string, unknown>);

beforeEach(() => {
  state.pending.length = 0;
  state.agent.mockReset();
});

describe('adding a comment from the canvas page', () => {
  it('@feega on a pinned node runs the agent on it and answers in the thread', async () => {
    const fake = thread();
    state.agent.mockResolvedValue({ ok: true, text: 'Made it darker.' });

    await post(fake, { body: '@feega make this darker', node_id: 'n1' });
    await Promise.all(state.pending);

    expect(state.agent).toHaveBeenCalledWith(expect.objectContaining({ nodeIds: ['n1'], projectId: 'p', canvasId: 'c' }));
    const [comment, reply] = inserts(fake);
    expect(comment).toMatchObject({ body: '@feega make this darker', node_id: 'n1', author_id: 'u1' });
    expect(reply).toMatchObject({ body: 'Made it darker.', author_id: 'u1', mentions: [AGENT_MENTION_ID], parent_id: expect.any(String) });
  });

  it('a plain comment does not wake the agent', async () => {
    const fake = thread();

    await post(fake, { body: 'looks good', node_id: 'n1' });
    await Promise.all(state.pending);

    expect(state.agent).not.toHaveBeenCalled();
    expect(inserts(fake)).toHaveLength(1);
  });

  it('stores the comment under the id the canvas already shows', async () => {
    const fake = thread();
    const id = '6a1d3f0e-2b8c-4f55-8e0a-5d2f7c9b1a44';

    expect(await post(fake, { id, body: 'looks good', node_id: 'n1' })).toMatchObject({ id });
    expect(inserts(fake)[0]).toMatchObject({ id });
  });

  it('a refused comment does not wake it either', async () => {
    const fake = thread();

    await post(fake, { body: '   @feega', parent_id: 'ghost' });
    await Promise.all(state.pending);

    expect(state.agent).not.toHaveBeenCalled();
  });
});
