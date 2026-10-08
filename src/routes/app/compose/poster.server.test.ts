import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const state = { uploads: [] as string[], db: null as unknown };
  state.db = { storage: { from: () => ({ upload: async (path: string) => (state.uploads.push(path), { error: null }) }) } };
  return state;
});

vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope: async () => ({ db: fake.db, orgId: 'org', projectId: 'p1', userId: 'u1' }) }));
const insertAsset = vi.fn();
const patchNodeData = vi.fn();
const findNode = vi.fn();
vi.mock('$lib/server/repos/assets', async (original) => ({ ...(await original<object>()), insertAsset }));
vi.mock('$lib/server/repos/canvas', async (original) => ({ ...(await original<object>()), findNode, patchNodeData }));

const { actions } = await import('./+page.server');

const motion = (projectId: string) => ({ id: 'm1', canvasId: 'c1', projectId, type: 'motion', displayName: 'Reel', data: { format: 'vertical', docHeadRevision: 2, posterAssetId: null, lastRenderAssetId: 'r1' }, version: 3 });

function event(node: string) {
  const body = new FormData();
  body.set('node', node);
  body.set('file', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'p.jpg', { type: 'image/jpeg' }));
  body.set('width', '270');
  body.set('height', '480');
  return { request: new Request('http://x/app/compose', { method: 'POST', body }), url: new URL('http://x/app/compose') } as never;
}

describe('/app/compose backfills a poster from the last render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.uploads.length = 0;
    insertAsset.mockResolvedValue({ id: 'poster-9' });
    patchNodeData.mockResolvedValue({ outcome: 'written' });
  });

  it('stores the frame and sets posterAssetId on a composition of this project', async () => {
    findNode.mockResolvedValue(motion('p1'));

    expect(await actions.poster(event('m1'))).toEqual({ assetId: 'poster-9' });
    expect(fake.uploads[0]).toMatch(/^org\/p1\/motion\/m1\/poster-[\w-]+\.jpg$/);
    expect(patchNodeData).toHaveBeenCalledWith(fake.db, expect.objectContaining({ nodeId: 'm1', patch: { posterAssetId: 'poster-9' } }));
  });

  it('a node of another project is not found and nothing is written', async () => {
    findNode.mockResolvedValue(motion('p2'));

    expect(await actions.poster(event('m1'))).toMatchObject({ status: 404 });
    expect(fake.uploads).toEqual([]);
  });
});
