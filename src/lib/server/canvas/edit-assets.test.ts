import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { insertAsset, findAsset, signMediaPaths } = vi.hoisted(() => ({
  insertAsset: vi.fn(async (_db: unknown, input: Record<string, unknown>) => ({ id: 'asset-new', ...input })),
  findAsset: vi.fn(),
  signMediaPaths: vi.fn(async () => ['https://signed.test/pic.png'])
}));

vi.mock('$lib/server/repos/assets', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/assets')>()), insertAsset, findAsset }));

vi.mock('./sign-media', () => ({ signMediaPaths }));

import sharp from 'sharp';
import { paddedPng, pixelSizeOf, storePng } from './edit-assets';
import { outpaintPlan } from '$lib/outpaint';

const upload = vi.fn(async () => ({ error: null }));
const db = { storage: { from: () => ({ upload }) } } as never;
const SCOPE = { orgId: 'org', projectId: 'p1', userId: 'u1' };

beforeEach(() => {
  insertAsset.mockClear();
  findAsset.mockReset();
  upload.mockClear();
});

describe('storePng', () => {
  it('keeps the png under the user in generated storage and records it as an asset of the project', async () => {
    const asset = await storePng(db, { ...SCOPE, nodeId: 'n1', png: Buffer.from([1, 2, 3]), width: 40, height: 20 });

    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^u1\/media\/edits\/.+\.png$/), expect.any(Blob), expect.objectContaining({ contentType: 'image/png' }));
    expect(insertAsset).toHaveBeenCalledWith(db, expect.objectContaining({ orgId: 'org', projectId: 'p1', type: 'image', source: 'generated', mimeType: 'image/png', bytes: 3, sourceNodeId: 'n1', width: 40, height: 20 }));
    expect(asset.id).toBe('asset-new');
  });

  it('fails loudly when the file did not land', async () => {
    upload.mockResolvedValueOnce({ error: { message: 'bucket gone' } } as never);

    await expect(storePng(db, { ...SCOPE, nodeId: 'n1', png: Buffer.from([1]), width: 1, height: 1 })).rejects.toThrow('store_failed: bucket gone');
  });
});

describe('pixelSizeOf', () => {
  it('reads the size the asset already records', async () => {
    findAsset.mockResolvedValue({ id: 'a1', type: 'image', url: 'u1/pic.png', width: 800, height: 600 });

    expect(await pixelSizeOf(db, { orgId: 'org', assetId: 'a1' })).toEqual({ width: 800, height: 600 });
    expect(signMediaPaths).not.toHaveBeenCalled();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('measures the file when the asset records no size', async () => {
    const png = await sharp({ create: { width: 32, height: 16, channels: 3, background: '#000' } }).png().toBuffer();
    findAsset.mockResolvedValue({ id: 'a1', type: 'image', url: 'u1/pic.png', width: null, height: null });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(png))));

    expect(await pixelSizeOf(db, { orgId: 'org', assetId: 'a1' })).toEqual({ width: 32, height: 16 });
  });

  it('says nothing for an asset that is missing or not an image', async () => {
    findAsset.mockResolvedValue(null);
    expect(await pixelSizeOf(db, { orgId: 'org', assetId: 'a1' })).toBeNull();

    findAsset.mockResolvedValue({ id: 'a1', type: 'video', url: 'u1/clip.mp4', width: null, height: null });
    expect(await pixelSizeOf(db, { orgId: 'org', assetId: 'a1' })).toBeNull();
  });
});

describe('paddedPng', () => {
  it('puts the picture on a larger canvas at the planned offset', async () => {
    const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#f00' } }).png().toBuffer();
    findAsset.mockResolvedValue({ id: 'a1', type: 'image', url: 'u1/pic.png', width: 20, height: 10 });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(png))));
    const plan = outpaintPlan({ width: 20, height: 10 }, { left: 0.5, right: 0, top: 0, bottom: 0 });

    const padded = await paddedPng(db, { orgId: 'org', assetId: 'a1' }, { width: 20, height: 10 }, plan);

    const { data, info } = await sharp(padded).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect({ width: info.width, height: info.height }).toEqual({ width: 30, height: 10 });
    const pixel = (x: number) => [data[x * 3], data[x * 3 + 1], data[x * 3 + 2]];
    expect(pixel(15)).toEqual([255, 0, 0]);
    expect(pixel(2)).not.toEqual([255, 0, 0]);
    vi.unstubAllGlobals();
  });
});
