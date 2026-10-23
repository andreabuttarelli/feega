import { beforeEach, describe, expect, it, vi } from 'vitest';

const findSharedCanvas = vi.fn();
const savedMotion = vi.fn();
const findAssets = vi.fn();
const namedAssets = vi.fn();
const copyAssetFiles = vi.fn();
const landMotionDoc = vi.fn();
const findProjectById = vi.fn();

vi.mock('./canvas-share', () => ({ findSharedCanvas: (...a: unknown[]) => findSharedCanvas(...a) }));
vi.mock('$lib/server/motion/agent-embed', () => ({ savedMotion: (...a: unknown[]) => savedMotion(...a) }));
vi.mock('$lib/server/repos/assets', () => ({ findAssets: (...a: unknown[]) => findAssets(...a) }));
vi.mock('$lib/server/motion/editor', () => ({ namedAssets: (...a: unknown[]) => namedAssets(...a) }));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: (...a: unknown[]) => findProjectById(...a) }));
vi.mock('$lib/server/gallery/remix', () => ({
  RemixError: { NotFound: 'item_not_found', ProjectNotFound: 'project_not_found', CanvasNotFound: 'canvas_not_found', ForeignFile: 'foreign_file', NotSaved: 'not_saved' },
  copyAssetFiles: (...a: unknown[]) => copyAssetFiles(...a),
  landMotionDoc: (...a: unknown[]) => landMotionDoc(...a)
}));

const { duplicateSharedFrame } = await import('./frame-duplicate');

const SOURCE = { source: {} as never, target: {} as never, sign: vi.fn(), isPublished: vi.fn(async () => true) };
const INPUT = { token: 'tok', frameId: 'f1', orgId: 'org-me', userId: 'u-me', actor: { kind: 'user', id: 'u-me' } as never, projectId: 'p-me', canvasId: null };
const DOC = { width: 1920, height: 1080, assets: [{ id: 'a1', kind: 'image' }, { id: 'a2', kind: 'image' }], tracks: [] };

beforeEach(() => {
  vi.clearAllMocks();
  SOURCE.isPublished.mockResolvedValue(true);
  findSharedCanvas.mockResolvedValue({ id: 'c-src', org_id: 'org-src', project_id: 'p-src', name: 'Launch' });
  savedMotion.mockResolvedValue({ record: { canvasId: 'c-src', displayName: 'Intro' }, version: 2, doc: DOC });
  findProjectById.mockResolvedValue({ id: 'p-me' });
  findAssets.mockResolvedValue(
    new Map([
      ['a1', { id: 'a1', uncensored: false }],
      ['a2', { id: 'a2', uncensored: true }]
    ])
  );
  namedAssets.mockResolvedValue([{ id: 'a1', kind: 'image', label: 'pic', url: 'https://signed/a1' }]);
  copyAssetFiles.mockResolvedValue({ a1: 'a1-copy' });
  landMotionDoc.mockResolvedValue({ ok: true, start: { projectId: 'p-me', canvasId: 'c-me', nodeId: 'n-me' }, editorPath: '/p/p-me/c/c-me/motion/n-me' });
});

describe('duplicateSharedFrame', () => {
  it('copies the frame and its files into the signed-in workspace, then lands the doc with the new asset ids', async () => {
    const result = await duplicateSharedFrame(SOURCE, INPUT);

    expect(result).toMatchObject({ ok: true, editorPath: '/p/p-me/c/c-me/motion/n-me', title: 'Intro' });
    expect(copyAssetFiles).toHaveBeenCalledWith(SOURCE.target, {}, { orgId: 'org-me', projectId: 'p-me' }, [expect.objectContaining({ id: 'a1', url: 'https://signed/a1' })]);
    expect(landMotionDoc).toHaveBeenCalledWith(SOURCE.target, expect.objectContaining({ orgId: 'org-me', projectId: 'p-me', title: 'Intro', doc: expect.objectContaining({ assets: expect.any(Array) }) }));
  });

  it('never copies a file flagged uncensored', async () => {
    await duplicateSharedFrame(SOURCE, INPUT);

    expect(namedAssets).toHaveBeenCalledWith(expect.anything(), ['a1']);
  });

  it('a revoked link copies nothing', async () => {
    findSharedCanvas.mockResolvedValue(null);

    expect(await duplicateSharedFrame(SOURCE, INPUT)).toMatchObject({ ok: false, error: 'item_not_found' });
    expect(landMotionDoc).not.toHaveBeenCalled();
  });

  it('a frame of another canvas copies nothing', async () => {
    savedMotion.mockResolvedValue({ record: { canvasId: 'c-other', displayName: 'X' }, version: 2, doc: DOC });

    expect(await duplicateSharedFrame(SOURCE, INPUT)).toMatchObject({ ok: false, error: 'item_not_found' });
  });

  it('a frame that was never published copies nothing', async () => {
    SOURCE.isPublished.mockResolvedValue(false);

    expect(await duplicateSharedFrame(SOURCE, INPUT)).toMatchObject({ ok: false, error: 'item_not_found' });
  });

  it('a project that is not the caller’s is refused before any file is copied', async () => {
    findProjectById.mockResolvedValue(null);

    expect(await duplicateSharedFrame(SOURCE, INPUT)).toMatchObject({ ok: false, error: 'project_not_found' });
    expect(copyAssetFiles).not.toHaveBeenCalled();
  });
});
