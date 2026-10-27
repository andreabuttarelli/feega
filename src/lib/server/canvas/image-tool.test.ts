import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { startImageTool, type ImageToolDeps } from './image-tool';
import { IMAGE_TOOL_MODEL, ImageTool, REFRAME_PROMPT } from '$lib/image-tools';

const db = {} as never;
const SCOPE = { orgId: 'org', projectId: 'p1', userId: 'u1' };

const source = { id: 'n-src', canvasId: 'c1', projectId: 'p1', type: 'image', displayName: 'Shoe', position: { x: 100, y: 40, z: 0 }, size: { width: 320, height: 240 }, data: { refId: 'asset-1' }, version: 3 };

const TITLE_AND_PARROT = [
  { label: 'title', box: { left: 0.1, top: 0.05, width: 0.8, height: 0.15 } },
  { label: 'parrot', box: { left: 0.33, top: 0.274, width: 0.311, height: 0.717 } }
];

function deps(over: Partial<ImageToolDeps> = {}): ImageToolDeps {
  return {
    findNode: vi.fn(async () => source),
    createNode: vi.fn(async () => ({ id: 'n-out', version: 1 })),
    createConnection: vi.fn(async () => ({ id: 'e1' })),
    runGenNode: vi.fn(async () => ({ kind: 'queued', run: { id: 'r1' } })),
    detectLayers: vi.fn(async () => TITLE_AND_PARROT),
    pixelSizeOf: vi.fn(async () => ({ width: 80, height: 40 })),
    storePng: vi.fn(async (_db: unknown, input: { png: Buffer }) => ({ id: input.png.byteLength === 7 ? 'padded-asset' : 'mask-asset' })),
    paddedPng: vi.fn(async () => Buffer.from('padded!')),
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

  it('split layers: detects the elements first, prompts the model with their boxes and keeps the boxes on the node', async () => {
    const d = deps();

    const out = await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.SplitLayers });

    const prompt = 'Separate the title <bbox>100 50 900 200</bbox> and the parrot <bbox>330 274 641 991</bbox> into independent layers';
    expect(out).toMatchObject({ ok: true, nodeId: 'n-out' });
    expect(d.detectLayers).toHaveBeenCalledWith(db, { orgId: 'org', assetId: 'asset-1' });
    expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ displayName: 'Layers', data: { prompt, model: IMAGE_TOOL_MODEL[ImageTool.SplitLayers], params: {}, layerBoxes: TITLE_AND_PARROT } }));
    expect(d.runGenNode).toHaveBeenCalledWith(db, expect.objectContaining({ prompt, model: IMAGE_TOOL_MODEL[ImageTool.SplitLayers] }));
  });

  it('split layers refuses before spending when no element is found', async () => {
    const d = deps({ detectLayers: vi.fn(async () => []) as never });

    const out = await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.SplitLayers });

    expect(out).toEqual({ ok: false, error: 'no_layers_found' });
    expect(d.createNode).not.toHaveBeenCalled();
    expect(d.runGenNode).not.toHaveBeenCalled();
  });

  it('the tools that need no detection never ask for it', async () => {
    const d = deps();

    await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.Upscale });

    expect(d.detectLayers).not.toHaveBeenCalled();
  });

  describe('outpaint', () => {
    const extend = { right: 0.5 };

    it('pads the picture, masks the new strip, and runs the edit model on the padded picture', async () => {
      const d = deps();

      const out = await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.Outpaint, prompt: 'more beach', extend });

      expect(out).toMatchObject({ ok: true, nodeId: 'n-out' });
      expect(d.paddedPng).toHaveBeenCalledWith(db, { orgId: 'org', assetId: 'asset-1' }, { width: 80, height: 40 }, expect.objectContaining({ padded: { width: 120, height: 40 } }));
      const stored = (d.storePng as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[1]);
      expect(stored.map((s) => ({ width: s.width, height: s.height }))).toEqual([{ width: 120, height: 40 }, { width: 120, height: 40 }]);
      const data = { prompt: 'more beach', model: IMAGE_TOOL_MODEL[ImageTool.Outpaint], params: { rendering_speed: 'BALANCED' }, editImageRefId: 'padded-asset', maskRefId: 'mask-asset' };
      expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ displayName: 'Outpaint', data }));
    });

    it('refuses before writing without a prompt, without an extension, or when the size is unknown', async () => {
      for (const [ask, over, error] of [
        [{ extend }, {}, 'prompt_required'],
        [{ prompt: 'more beach' }, {}, 'extend_required'],
        [{ prompt: 'more beach', extend }, { pixelSizeOf: vi.fn(async () => null) }, 'source_size_unknown']
      ] as const) {
        const d = deps(over as never);

        expect(await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.Outpaint, ...ask })).toEqual({ ok: false, error });
        expect(d.createNode).not.toHaveBeenCalled();
      }
    });
  });

  describe('reframe', () => {
    it('pads the picture to the asked aspect and fills the new area with the default prompt', async () => {
      const d = deps();

      const out = await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.Reframe, aspect: '1:1' });

      expect(out).toMatchObject({ ok: true, nodeId: 'n-out' });
      expect(d.paddedPng).toHaveBeenCalledWith(db, { orgId: 'org', assetId: 'asset-1' }, { width: 80, height: 40 }, expect.objectContaining({ padded: { width: 80, height: 80 } }));
      expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ displayName: 'Reframe 1:1', data: expect.objectContaining({ prompt: REFRAME_PROMPT, model: IMAGE_TOOL_MODEL[ImageTool.Reframe], editImageRefId: 'padded-asset' }) }));
    });

    it('refuses without an aspect, when the picture already has it, or when the size is unknown', async () => {
      for (const [ask, over, error] of [
        [{}, {}, 'aspect_required'],
        [{ aspect: '2:1' }, {}, 'already_this_aspect'],
        [{ aspect: '1:1' }, { pixelSizeOf: vi.fn(async () => null) }, 'source_size_unknown']
      ] as const) {
        const d = deps(over as never);

        expect(await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.Reframe, ...ask })).toEqual({ ok: false, error });
        expect(d.createNode).not.toHaveBeenCalled();
      }
    });
  });

  describe('inpaint', () => {
    const mask = { regions: [{ left: 0.5, top: 0, width: 0.5, height: 1 }] };

    it('draws the mask at the picture size, keeps it as an asset and runs the edit model with the prompt', async () => {
      const d = deps();

      const out = await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.Inpaint, prompt: 'a red hat', mask });

      expect(out).toMatchObject({ ok: true, nodeId: 'n-out' });
      expect(d.pixelSizeOf).toHaveBeenCalledWith(db, { orgId: 'org', assetId: 'asset-1' });
      const stored = (d.storePng as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(stored).toMatchObject({ orgId: 'org', projectId: 'p1', userId: 'u1', nodeId: 'n-src', width: 80, height: 40 });
      const meta = await sharp(stored.png).metadata();
      expect({ width: meta.width, height: meta.height }).toEqual({ width: 80, height: 40 });
      const data = { prompt: 'a red hat', model: IMAGE_TOOL_MODEL[ImageTool.Inpaint], params: { rendering_speed: 'BALANCED' }, maskRefId: 'mask-asset' };
      expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ displayName: 'Inpaint', data }));
      expect(d.runGenNode).toHaveBeenCalledWith(db, expect.objectContaining({ nodeId: 'n-out', prompt: 'a red hat', model: IMAGE_TOOL_MODEL[ImageTool.Inpaint] }));
    });

    it('refuses before writing anything without a prompt, without a mask, or when the picture has no known size', async () => {
      for (const [ask, over, error] of [
        [{ mask }, {}, 'prompt_required'],
        [{ prompt: 'a red hat' }, {}, 'mask_required'],
        [{ prompt: 'a red hat', mask }, { pixelSizeOf: vi.fn(async () => null) }, 'source_size_unknown']
      ] as const) {
        const d = deps(over as never);

        expect(await startImageTool(db, d, { ...SCOPE, sourceNodeId: 'n-src', tool: ImageTool.Inpaint, ...ask })).toEqual({ ok: false, error });
        expect(d.storePng).not.toHaveBeenCalled();
        expect(d.createNode).not.toHaveBeenCalled();
      }
    });
  });
});
