import { beforeEach, describe, expect, it, vi } from 'vitest';

const caller = vi.hoisted(() => ({ writeAllowed: true }));
const store = vi.hoisted(() => ({ revisions: [] as { doc: { comps: Record<string, { template?: { id: string } }> } }[], nodes: [] as Record<string, unknown>[] }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: {}, orgId: 'org-1', userId: 'u-1', writeAllowed: caller.writeAllowed } }) }));
vi.mock('$lib/server/repos/projects', () => ({
  listProjects: async () => [{ id: 'p-recent' }],
  findProjectById: async (_db: unknown, input: { projectId: string }) => (input.projectId === 'p-1' ? { id: 'p-1' } : null)
}));
vi.mock('$lib/server/repos/canvas', async (original) => ({
  ...(await original<object>()),
  listCanvases: async () => [{ id: 'c-motion', projectId: 'p-1', name: 'Motion', viewport: null }],
  listNodes: async () => [],
  createNode: async (_db: unknown, input: Record<string, unknown>) => {
    store.nodes.push(input);
    return { id: 'n-1', canvasId: 'c-motion' };
  },
  patchNodeData: async () => ({})
}));
vi.mock('$lib/server/repos/motion-revisions', async (original) => ({
  ...(await original<object>()),
  appendRevision: async (_db: unknown, input: { doc: never }) => {
    store.revisions.push(input);
    return { outcome: 'written', head: { version: 1, doc: input.doc, summary: null, actorKind: 'agent' } };
  }
}));
vi.mock('$lib/server/repos/motion-templates', () => ({ listOrgTemplates: async () => [] }));

const { POST } = await import('./+server');

const post = (body: unknown) => {
  const url = new URL('https://feega.app/api/v1/motion/from-template');
  return POST({ request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer k' }, body: JSON.stringify(body) }), url } as never);
};

beforeEach(() => {
  caller.writeAllowed = true;
  store.revisions = [];
  store.nodes = [];
});

describe('POST /api/v1/motion/from-template', () => {
  it('creates a video holding the component and answers where to edit it', async () => {
    const res = await post({ template: 'builtin:prompt-input', format: '1:1', project: 'p-1' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ node_id: 'n-1', project_id: 'p-1', canvas_id: 'c-motion', version: 1, editor_url: '/p/p-1/c/c-motion/motion/n-1' });
    expect(store.nodes[0]).toMatchObject({ projectId: 'p-1', type: 'motion', actor: { kind: 'agent', id: 'u-1' } });
    expect(Object.values(store.revisions[0].doc.comps).some((c) => c.template?.id === 'builtin:prompt-input')).toBe(true);
  });

  it('without a project, lands in the most recent one', async () => {
    const res = await post({ template: 'builtin:prompt-input' });
    expect((await res.json()).project_id).toBe('p-recent');
  });

  it('refuses a project of another org, an unknown component, a bad format and a read-only key', async () => {
    expect((await post({ template: 'builtin:prompt-input', project: 'p-other' })).status).toBe(404);
    expect((await post({ template: 'builtin:nope', project: 'p-1' })).status).toBe(404);
    expect((await post({ template: 'builtin:prompt-input', format: '21:9' })).status).toBe(400);
    caller.writeAllowed = false;
    expect((await post({ template: 'builtin:prompt-input' })).status).toBe(403);
    expect(store.nodes).toEqual([]);
  });
});
