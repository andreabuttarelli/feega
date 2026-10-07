import { describe, expect, it, vi } from 'vitest';
import { startUpscale, UPSCALE_CANVAS_NAME, type UpscaleStartDeps } from './start';
import { UpscaleMode, UpscaleTarget } from '$lib/upscale';
import { OPENROUTER_UPSCALE_MODEL } from '$lib/video-models';

const db = {} as never;
const SCOPE = { orgId: 'org', projectId: 'p1', userId: 'u1' };
const PROBE = { width: 854, height: 480, seconds: 2 };

const videoAsset = { id: 'a-src', projectId: 'p1', type: 'video', url: 'org/p1/clip.mp4', mimeType: 'video/mp4', bytes: 200_000, source: 'upload' };

function deps(over: Partial<UpscaleStartDeps> = {}): UpscaleStartDeps {
  return {
    listCanvases: vi.fn(async () => []),
    listNodes: vi.fn(async () => []),
    createCanvas: vi.fn(async () => ({ id: 'c-up', projectId: 'p1', name: UPSCALE_CANVAS_NAME, viewport: null })),
    registerCanvasUpload: vi.fn(async () => ({ asset: videoAsset, node: { id: 'n-src' } })),
    findAsset: vi.fn(async () => videoAsset),
    createNode: vi.fn(async (_db: unknown, input: { type: string; data?: Record<string, unknown> }) => ({ id: input.data?.assetId ? 'n-src' : 'n-up', version: 1 })),
    createConnection: vi.fn(async () => ({ id: 'e1' })),
    runGenNode: vi.fn(async () => ({ kind: 'queued', run: {} })),
    ...over
  } as unknown as UpscaleStartDeps;
}

const upload = { kind: 'upload' as const, path: 'org/p1/x-clip.mp4', fileName: 'clip.mp4', mimeType: 'video/mp4', bytes: 200_000 };

describe('startUpscale wires an upscale on the Upscale canvas and runs it', () => {
  it('an upload becomes a source node wired into an upscale node that runs on FLUX with the planned factor', async () => {
    const d = deps();

    const out = await startUpscale(db, d, { ...SCOPE, source: upload, probe: PROBE, target: UpscaleTarget.Double, mode: UpscaleMode.Precise });

    expect(out).toEqual({ ok: true, canvasId: 'c-up', nodeId: 'n-up' });
    expect(d.createCanvas).toHaveBeenCalledWith(db, { orgId: 'org', projectId: 'p1', name: UPSCALE_CANVAS_NAME });
    expect(d.registerCanvasUpload).toHaveBeenCalledWith(db, expect.objectContaining({ canvasId: 'c-up', path: upload.path }));
    expect(d.createNode).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ type: 'video', data: { prompt: '', model: OPENROUTER_UPSCALE_MODEL, params: { upscale_factor: 2, creativity: 0, duration: 2 } } })
    );
    expect(d.createConnection).toHaveBeenCalledWith(db, expect.objectContaining({ sourceNodeId: 'n-src', targetNodeId: 'n-up', targetHandle: 'videos' }));
    expect(d.runGenNode).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ nodeId: 'n-up', medium: 'video', model: OPENROUTER_UPSCALE_MODEL, params: { upscale_factor: 2, creativity: 0, duration: 2 }, expectedVersion: 1 })
    );
  });

  it('reuses the Upscale canvas when the project has one', async () => {
    const d = deps({ listCanvases: vi.fn(async () => [{ id: 'c-old', projectId: 'p1', name: UPSCALE_CANVAS_NAME, viewport: null }]) as never });

    await startUpscale(db, d, { ...SCOPE, source: upload, probe: PROBE, target: UpscaleTarget.Double, mode: UpscaleMode.Precise });

    expect(d.createCanvas).not.toHaveBeenCalled();
  });

  it('a library video is placed on the canvas as a source node, not uploaded again', async () => {
    const d = deps();

    const out = await startUpscale(db, d, { ...SCOPE, source: { kind: 'asset', assetId: 'a-src' }, probe: PROBE, target: UpscaleTarget.FourK, mode: UpscaleMode.Creative });

    expect(out).toMatchObject({ ok: true });
    expect(d.registerCanvasUpload).not.toHaveBeenCalled();
    expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ data: expect.objectContaining({ assetId: 'a-src' }) }));
    expect(d.runGenNode).toHaveBeenCalledWith(db, expect.objectContaining({ params: { upscale_factor: 3, creativity: 1, duration: 2 } }));
  });

  it('a clip over the model limits is refused before anything is written', async () => {
    const d = deps();

    const out = await startUpscale(db, d, { ...SCOPE, source: upload, probe: { ...PROBE, seconds: 25 }, target: UpscaleTarget.Double, mode: UpscaleMode.Precise });

    expect(out).toEqual({ ok: false, error: 'too_long' });
    expect(d.createCanvas).not.toHaveBeenCalled();
  });

  it('a library asset of another project or not a video is refused', async () => {
    const d = deps({ findAsset: vi.fn(async () => ({ ...videoAsset, type: 'image' })) as never });

    const out = await startUpscale(db, d, { ...SCOPE, source: { kind: 'asset', assetId: 'a-src' }, probe: PROBE, target: UpscaleTarget.Double, mode: UpscaleMode.Precise });

    expect(out).toEqual({ ok: false, error: 'source_not_found' });
  });

  it('a provider refusal comes back as the error', async () => {
    const d = deps({ runGenNode: vi.fn(async () => ({ kind: 'refused', error: 'render_failed' })) as never });

    const out = await startUpscale(db, d, { ...SCOPE, source: upload, probe: PROBE, target: UpscaleTarget.Double, mode: UpscaleMode.Precise });

    expect(out).toEqual({ ok: false, error: 'render_failed' });
  });
});
