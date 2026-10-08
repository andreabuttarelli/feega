import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG = 'org-1';

const store = vi.hoisted(() => ({ asked: [] as Record<string, unknown>[] }));

const motion = (id: string, projectId: string, data: Record<string, unknown>) => ({ id, projectId, canvasId: 'c-1', type: 'motion', displayName: `video ${id}`, data: { format: '16:9', docHeadRevision: 4, posterAssetId: null, lastRenderAssetId: null, ...data } });

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: { storage: { from: () => ({ createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed/${path}` } }) }) } }, orgId: ORG, userId: 'u-1', writeAllowed: false } }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  listMotionNodes: async (_db: unknown, scope: Record<string, unknown>) => {
    store.asked.push(scope);
    return [motion('n-1', 'p-1', { posterAssetId: 'a-poster' }), motion('n-2', 'p-1', { lastRenderAssetId: 'a-render' })];
  }
}));
vi.mock('$lib/server/repos/assets', () => ({
  findAssets: async (_db: unknown, input: { assetIds: string[] }) => new Map(input.assetIds.map((id) => [id, { id, url: `${ORG}/p-1/${id}.bin` }]))
}));

const { GET } = await import('./+server');

const list = (query = '') => {
  const url = new URL(`https://feega.app/api/v1/motion${query}`);
  return GET({ request: new Request(url, { headers: { authorization: 'Bearer k' } }), url } as never);
};

beforeEach(() => {
  store.asked = [];
});

describe('GET /api/v1/motion', () => {
  it('lists the motion videos of the org with revision, poster and last render', async () => {
    const res = await list();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(store.asked[0]).toEqual({ orgId: ORG, projectId: null });
    expect(body.videos).toEqual([
      { node_id: 'n-1', name: 'video n-1', project_id: 'p-1', canvas_id: 'c-1', format: '16:9', version: 4, poster_url: `https://signed/${ORG}/p-1/a-poster.bin`, last_render_url: null, editor_url: '/p/p-1/c/c-1/motion/n-1' },
      { node_id: 'n-2', name: 'video n-2', project_id: 'p-1', canvas_id: 'c-1', format: '16:9', version: 4, poster_url: null, last_render_url: `https://signed/${ORG}/p-1/a-render.bin`, editor_url: '/p/p-1/c/c-1/motion/n-2' }
    ]);
  });

  it('narrows to one project', async () => {
    await list('?project=p-1');
    expect(store.asked[0]).toEqual({ orgId: ORG, projectId: 'p-1' });
  });
});
