import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertAsset = vi.fn();
const patchNodeData = vi.fn();
const markGenerated = vi.fn();

vi.mock('$lib/server/repos/assets', () => ({ insertAsset }));
vi.mock('$lib/server/repos/canvas', () => ({ patchNodeData, DataCheck: { Schema: 'schema', None: 'none' } }));
vi.mock('$lib/server/content-credentials', () => ({ markGenerated, DIGITAL_SOURCE_TYPE: { composite: 'compositeWithTrainedAlgorithmicMedia' } }));

const { saveExport } = await import('./export');
const { exportPath } = await import('$lib/motion/export-plan');

const MP4 = Buffer.from('....ftypisom-movie');
const scope = { orgId: 'org', projectId: 'prj', nodeId: 'node', actor: { kind: 'user' as const, id: 'u' } };
const file = { width: 1080, height: 1920, seconds: 15 };

function fakeDb(stored: Buffer | null) {
  const uploads: { path: string; bytes: number; upsert: boolean }[] = [];
  const removed: string[] = [];
  const bucket = {
    download: async () => (stored ? { data: new Blob([new Uint8Array(stored)]), error: null } : { data: null, error: { message: 'not found' } }),
    upload: async (path: string, body: Buffer, opts: { upsert: boolean }) => {
      uploads.push({ path, bytes: body.length, upsert: opts.upsert });
      return { error: null };
    },
    remove: async (paths: string[]) => {
      removed.push(...paths);
      return { error: null };
    }
  };
  return { db: { storage: { from: () => bucket } } as never, uploads, removed };
}

describe('saving a browser export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertAsset.mockResolvedValue({ id: 'asset-1' });
    patchNodeData.mockResolvedValue({ outcome: 'written' });
    markGenerated.mockImplementation(async (bytes: Buffer) => ({ bytes: Buffer.concat([bytes, Buffer.from('xmp')]), marked: true }));
  });

  it('marks the file, stores the marked bytes, registers a video asset and attaches it to the motion node', async () => {
    const { db, uploads, removed } = fakeDb(MP4);
    const path = exportPath(scope, 'abc');
    const marked = exportPath(scope, 'abc-cc');

    const saved = await saveExport(db, { ...scope, ...file, path });

    expect(saved).toEqual({ ok: true, assetId: 'asset-1' });
    expect(markGenerated).toHaveBeenCalledWith(MP4, 'video/mp4', expect.objectContaining({ sourceType: 'compositeWithTrainedAlgorithmicMedia' }));
    expect(uploads).toEqual([{ path: marked, bytes: MP4.length + 3, upsert: false }]);
    expect(removed).toEqual([path]);
    expect(insertAsset).toHaveBeenCalledWith(db, expect.objectContaining({ type: 'video', url: marked, mimeType: 'video/mp4', durationS: 15, width: 1080, height: 1920, sourceNodeId: 'node', aiMarked: true, bytes: MP4.length + 3 }));
    expect(patchNodeData).toHaveBeenCalledWith(db, expect.objectContaining({ nodeId: 'node', patch: { lastRenderAssetId: 'asset-1' } }));
  });

  it('refuses a path outside this motion node folder', async () => {
    const { db } = fakeDb(MP4);

    expect(await saveExport(db, { ...scope, ...file, path: 'other-org/prj/motion/node/x.mp4' })).toEqual({ ok: false, error: 'invalid_path' });
    expect(await saveExport(db, { ...scope, ...file, path: `${exportPath(scope, 'x')}/../../../y.mp4` })).toEqual({ ok: false, error: 'invalid_path' });
    expect(insertAsset).not.toHaveBeenCalled();
  });

  it('says so when the upload never landed', async () => {
    const { db } = fakeDb(null);

    expect(await saveExport(db, { ...scope, ...file, path: exportPath(scope, 'abc') })).toEqual({ ok: false, error: 'file_not_found' });
  });

  it('keeps the original bytes when marking fails, and records it as unmarked', async () => {
    markGenerated.mockResolvedValue({ bytes: MP4, marked: false });
    const { db, uploads } = fakeDb(MP4);

    await saveExport(db, { ...scope, ...file, path: exportPath(scope, 'abc') });

    expect(uploads).toEqual([]);
    expect(insertAsset).toHaveBeenCalledWith(db, expect.objectContaining({ aiMarked: false }));
  });
});
