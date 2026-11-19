import { describe, expect, it, vi } from 'vitest';
import { FigmaOutcome, MAX_HASHES, importFigmaImages } from './import-images';

const FILE = 'AbCdEf1234567890';
const HASH_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HASH_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const answer = (status: number, data: unknown) => ({ status, data, headers: {}, file: null });

describe('importing the images of a Figma file', () => {
  const imagesOf = (images: Record<string, string>) => async () => answer(200, { meta: { images } });

  it('maps each hash to the asset its downloaded image became', async () => {
    const call = vi.fn(imagesOf({ [HASH_A]: 'https://s3/a.png', [HASH_B]: 'https://s3/b.png' }));
    const importUrl = vi.fn(async (url: string) => `asset-of-${url.split('/').pop()}`);

    const done = await importFigmaImages({ fileKey: FILE, hashes: [HASH_A, HASH_B] }, { call, importUrl });

    expect(done).toEqual({ outcome: FigmaOutcome.Ok, assets: { [HASH_A]: 'asset-of-a.png', [HASH_B]: 'asset-of-b.png' } });
    expect(call).toHaveBeenCalledWith({ endpoint: `https://api.figma.com/v1/files/${FILE}/images` });
  });

  it('skips an image that is missing from Figma or cannot be stored', async () => {
    const call = imagesOf({ [HASH_A]: 'https://s3/a.png' });

    const done = await importFigmaImages({ fileKey: FILE, hashes: [HASH_A, HASH_B] }, { call, importUrl: async () => null });

    expect(done).toEqual({ outcome: FigmaOutcome.Ok, assets: {} });
  });

  it('reports a rejected connection', async () => {
    const done = await importFigmaImages({ fileKey: FILE, hashes: [HASH_A] }, { call: async () => answer(403, {}), importUrl: async () => 'x' });

    expect(done).toEqual({ outcome: FigmaOutcome.Rejected, assets: {} });
  });

  it('reports an unreachable Figma', async () => {
    const done = await importFigmaImages({ fileKey: FILE, hashes: [HASH_A] }, { call: async () => answer(0, null), importUrl: async () => 'x' });

    expect(done.outcome).toBe(FigmaOutcome.Unavailable);
  });

  it('refuses a file key or a hash that is not one before calling Figma', async () => {
    const call = vi.fn();

    expect((await importFigmaImages({ fileKey: '../x', hashes: [HASH_A] }, { call, importUrl: async () => 'x' })).outcome).toBe(FigmaOutcome.Invalid);
    expect((await importFigmaImages({ fileKey: FILE, hashes: ['nope'] }, { call, importUrl: async () => 'x' })).outcome).toBe(FigmaOutcome.Invalid);
    expect(call).not.toHaveBeenCalled();
  });

  it('refuses more hashes than the cap', async () => {
    const many = Array.from({ length: MAX_HASHES + 1 }, (_, i) => i.toString(16).padStart(40, '0'));

    const done = await importFigmaImages({ fileKey: FILE, hashes: many }, { call: vi.fn(), importUrl: async () => 'x' });

    expect(done.outcome).toBe(FigmaOutcome.Invalid);
  });
});
