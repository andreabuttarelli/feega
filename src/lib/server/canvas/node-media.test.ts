import { describe, it, expect, vi, beforeEach } from 'vitest';

const findAssets = vi.fn();
const findNode = vi.fn();
const findRunOutputs = vi.fn();
const signStoredFile = vi.fn();
const signStoredPreview = vi.fn();

vi.mock('$lib/server/repos/assets', () => ({ findAssets: (...a: unknown[]) => findAssets(...a) }));
vi.mock('$lib/server/repos/canvas', () => ({ findNode: (...a: unknown[]) => findNode(...a) }));
vi.mock('$lib/server/repos/node-runs', () => ({ findRunOutputs: (...a: unknown[]) => findRunOutputs(...a) }));
vi.mock('$lib/server/repos/asset-storage', async (importActual) => ({
  SIGNED_URL_TTL_S: (await importActual<typeof import('$lib/server/repos/asset-storage')>()).SIGNED_URL_TTL_S,
  BUCKET_BY_SOURCE: (await importActual<typeof import('$lib/server/repos/asset-storage')>()).BUCKET_BY_SOURCE,
  signStoredFile: (...a: unknown[]) => signStoredFile(...a),
  signStoredPreview: (...a: unknown[]) => signStoredPreview(...a)
}));

import { loadMedia } from './node-media';

const ORG = 'org-1';
const asset = (id: string, over: Record<string, unknown> = {}) => ({
  id, projectId: 'p1', type: 'image', url: `u1/media/${id}.png`, content: null, mimeType: 'image/png',
  bytes: 10, width: 1366, height: 2048, durationS: null, source: 'generated', sourceNodeId: null, createdAt: 'now', ...over
});

beforeEach(() => {
  vi.clearAllMocks();
  findNode.mockResolvedValue(null);
  findRunOutputs.mockResolvedValue([]);
  findAssets.mockImplementation(async (_db, { assetIds }) =>
    new Map((assetIds as string[]).filter((id) => id !== 'foreign').map((id) => [id, asset(id)])));
  signStoredFile.mockImplementation(async (_db, bucket, path) => `https://s/${bucket}/${path}`);
  signStoredPreview.mockImplementation(async (_db, bucket, path) => `https://s/${bucket}/${path}?w=1024`);
});

describe('loadMedia', () => {
  it('resolves a node, a run and an asset to signed media, scoped to the org', async () => {
    findNode.mockResolvedValue({ id: 'n1', data: { refId: 'a-node' } });
    findRunOutputs.mockResolvedValue([{ id: 'r1', nodeId: 'n2', outputAssetId: 'a-run' }]);

    const out = await loadMedia({} as never, {} as never, { orgId: ORG, nodeIds: ['n1'], runIds: ['r1'], assetIds: ['a-direct'] });

    expect(findAssets).toHaveBeenCalledWith({}, { orgId: ORG, assetIds: ['a-node', 'a-run', 'a-direct'] });
    expect(out.items.map((i) => [i.assetId, i.nodeId, i.runId])).toEqual([
      ['a-node', 'n1', null], ['a-run', 'n2', 'r1'], ['a-direct', null, null]
    ]);
    expect(out.items[0]).toMatchObject({ type: 'image', mimeType: 'image/png', width: 1366, height: 2048,
      fullUrl: 'https://s/brand-knowledge/u1/media/a-node.png', previewUrl: 'https://s/brand-knowledge/u1/media/a-node.png?w=1024' });
    expect(out.missing).toEqual([]);
  });

  it('signs the user link for an hour and the agent preview for five minutes', async () => {
    await loadMedia({} as never, {} as never, { orgId: ORG, nodeIds: [], runIds: [], assetIds: ['a'] });

    expect(signStoredFile).toHaveBeenCalledWith({}, 'brand-knowledge', 'u1/media/a.png', 3600);
    expect(signStoredPreview).toHaveBeenCalledWith({}, 'brand-knowledge', 'u1/media/a.png', 300);
  });

  it('reports an asset of another org as missing, never signs it', async () => {
    const out = await loadMedia({} as never, {} as never, { orgId: ORG, nodeIds: [], runIds: [], assetIds: ['foreign'] });

    expect(out.items).toEqual([]);
    expect(out.missing).toEqual(['foreign']);
    expect(signStoredFile).not.toHaveBeenCalled();
  });

  it('signs an upload from canvas-assets and gives a video no preview', async () => {
    findAssets.mockResolvedValue(new Map([['v', asset('v', { type: 'video', source: 'upload', url: 'org-1/p1/v.mp4', mimeType: 'video/mp4', durationS: 5 })]]));

    const out = await loadMedia({} as never, {} as never, { orgId: ORG, nodeIds: [], runIds: [], assetIds: ['v'] });

    expect(out.items[0]).toMatchObject({ fullUrl: 'https://s/canvas-assets/org-1/p1/v.mp4', previewUrl: null, durationS: 5 });
  });

  it('returns a text asset content without signing', async () => {
    findAssets.mockResolvedValue(new Map([['t', asset('t', { type: 'text', url: null, content: 'ciao' })]]));

    const out = await loadMedia({} as never, {} as never, { orgId: ORG, nodeIds: [], runIds: [], assetIds: ['t'] });

    expect(out.items[0]).toMatchObject({ text: 'ciao', fullUrl: null, previewUrl: null });
  });

  it('reports a node with nothing produced yet as missing', async () => {
    findNode.mockResolvedValue({ id: 'n1', data: {} });

    const out = await loadMedia({} as never, {} as never, { orgId: ORG, nodeIds: ['n1'], runIds: [], assetIds: [] });

    expect(out.missing).toEqual(['n1']);
  });
});
