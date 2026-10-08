import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertAsset = vi.fn();
const patchNodeData = vi.fn();

vi.mock('$lib/server/repos/assets', async (original) => ({ ...(await original<object>()), insertAsset }));
vi.mock('$lib/server/repos/canvas', async (original) => ({ ...(await original<object>()), patchNodeData }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => ({ orgId: 'org-a', canvas: { id: 'c1', projectId: 'p1', name: 'C' }, projectBrandId: null }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));
vi.mock('$lib/server/motion/editor', () => ({ findMotionNode: async () => ({ record: { id: 'n1' }, node: {} }), assetUrls: vi.fn(), headOrNew: vi.fn(), motionAssets: vi.fn(), motionTokens: vi.fn(), saveMotionDoc: vi.fn() }));

const { actions } = await import('./+page.server');

function fakeDb() {
  const uploads: { path: string; type: string }[] = [];
  const bucket = {
    upload: async (path: string, file: File) => {
      uploads.push({ path, type: file.type });
      return { error: null };
    }
  };
  return { db: { storage: { from: () => bucket } }, uploads };
}

function event(db: unknown, file: File) {
  const form = new FormData();
  form.set('file', file);
  form.set('width', '480');
  form.set('height', '854');
  return {
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => db },
    params: { projectId: 'p1', canvasId: 'c1', nodeId: 'n1' },
    request: new Request('http://x', { method: 'POST', body: form })
  } as never;
}

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], 'poster.jpg', { type: 'image/jpeg' });

describe('the editor saves a poster for its composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertAsset.mockResolvedValue({ id: 'poster-1' });
    patchNodeData.mockResolvedValue({ outcome: 'written' });
  });

  it('stores the frame in the node folder, registers an image asset and sets posterAssetId', async () => {
    const { db, uploads } = fakeDb();

    const out = await actions.poster(event(db, jpeg()));

    expect(out).toEqual({ assetId: 'poster-1' });
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatchObject({ type: 'image/jpeg' });
    expect(uploads[0].path).toMatch(/^org-a\/p1\/motion\/n1\/poster-[\w-]+\.jpg$/);
    expect(insertAsset).toHaveBeenCalledWith(db, expect.objectContaining({ orgId: 'org-a', projectId: 'p1', type: 'image', url: uploads[0].path, mimeType: 'image/jpeg', width: 480, height: 854, sourceNodeId: 'n1' }));
    expect(patchNodeData).toHaveBeenCalledWith(db, expect.objectContaining({ orgId: 'org-a', nodeId: 'n1', patch: { posterAssetId: 'poster-1' }, check: 'schema' }));
  });

  it('refuses anything but a jpeg, and writes nothing', async () => {
    const { db, uploads } = fakeDb();

    const out = await actions.poster(event(db, new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })));

    expect(out).toMatchObject({ status: 400 });
    expect(uploads).toEqual([]);
    expect(insertAsset).not.toHaveBeenCalled();
  });
});
