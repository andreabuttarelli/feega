import { describe, expect, it, vi } from 'vitest';
import { startImageTool, type ImageToolDeps } from './image-tool';
import { IMAGE_TOOL_MODEL, ImageTool } from '$lib/image-tools';

const db = {} as never;
const SCOPE = { orgId: 'org', projectId: 'p1', userId: 'u1' };

const source = { id: 'n-src', canvasId: 'c1', projectId: 'p1', type: 'image', displayName: 'Shoe', position: { x: 100, y: 40, z: 0 }, size: { width: 320, height: 240 }, data: { refId: 'asset-1' }, version: 3 };

function deps(over: Partial<ImageToolDeps> = {}): ImageToolDeps {
  return {
    findNode: vi.fn(async () => source),
    createNode: vi.fn(async () => ({ id: 'n-out', version: 1 })),
    createConnection: vi.fn(async () => ({ id: 'e1' })),
    runGenNode: vi.fn(async () => ({ kind: 'queued', run: { id: 'r1' } })),
    ...over
  } as unknown as ImageToolDeps;
}

describe('startImageTool puts a tool node beside an image and runs it', () => {
  it('background removal: a new image node to the right, wired from the source, running the kie model with no prompt', async () => {
    const d = deps();

    const out = await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.RemoveBackground });

    expect(out).toEqual({ ok: true, canvasId: 'c1', nodeId: 'n-out', outcome: { kind: 'queued', run: { id: 'r1' } } });
    expect(d.createNode).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ canvasId: 'c1', type: 'image', y: 40, displayName: 'Remove background', data: { prompt: '', model: IMAGE_TOOL_MODEL[ImageTool.RemoveBackground], params: {} } })
    );
    expect((d.createNode as ReturnType<typeof vi.fn>).mock.calls[0][1].x).toBeGreaterThan(100 + 320);
    expect(d.createConnection).toHaveBeenCalledWith(db, expect.objectContaining({ canvasId: 'c1', sourceNodeId: 'n-src', targetNodeId: 'n-out' }));
    expect(d.runGenNode).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ nodeId: 'n-out', medium: 'image', prompt: '', model: IMAGE_TOOL_MODEL[ImageTool.RemoveBackground], params: {}, expectedVersion: 1 })
    );
  });

  it('upscale carries the factor to the node and the run', async () => {
    const d = deps();

    await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.Upscale, factor: '4' });

    expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ displayName: 'Upscale 4×', data: expect.objectContaining({ params: { upscale_factor: '4' } }) }));
    expect(d.runGenNode).toHaveBeenCalledWith(db, expect.objectContaining({ params: { upscale_factor: '4' } }));
  });

  it('refuses a missing node, a node that is not an image, and an image with no result, before writing', async () => {
    for (const [found, error] of [
      [null, 'node_not_found'],
      [{ ...source, type: 'text' }, 'source_not_image'],
      [{ ...source, data: {} }, 'source_empty']
    ] as const) {
      const d = deps({ findNode: vi.fn(async () => found) as never });

      const out = await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.RemoveBackground });

      expect(out).toEqual({ ok: false, error });
      expect(d.createNode).not.toHaveBeenCalled();
    }
  });

  it('passes a refusal from the run back as the error', async () => {
    const d = deps({ runGenNode: vi.fn(async () => ({ kind: 'refused', error: 'not_configured' })) as never });

    const out = await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.RemoveBackground });

    expect(out).toEqual({ ok: false, error: 'not_configured' });
  });
});
