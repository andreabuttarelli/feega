import { describe, expect, it, vi } from 'vitest';
import { FigmaOutcome, MAX_HASHES, figmaMe, importFigmaImages } from './import-images';

const TOKEN = 'figd_token';
const FILE = 'AbCdEf1234567890';
const HASH_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HASH_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('Figma token check', () => {
  it('asks /v1/me with the token and accepts a 200', async () => {
    const fetchFn = vi.fn(async () => answer(200, { handle: 'andrea' }));

    expect(await figmaMe(fetchFn, TOKEN)).toEqual({ ok: true, handle: 'andrea' });
    expect(fetchFn).toHaveBeenCalledWith('https://api.figma.com/v1/me', { headers: { 'X-Figma-Token': TOKEN } });
  });

  it('refuses a token Figma rejects', async () => {
    expect(await figmaMe(async () => answer(403, {}), TOKEN)).toEqual({ ok: false });
  });

  it('treats an unreachable Figma as a refusal', async () => {
    expect(await figmaMe(async () => Promise.reject(new Error('down')), TOKEN)).toEqual({ ok: false });
  });
});

describe('importing the images of a Figma file', () => {
  const imagesOf = (images: Record<string, string>) => async () => answer(200, { meta: { images } });

  it('maps each hash to the asset its downloaded image became', async () => {
    const fetchFn = vi.fn(imagesOf({ [HASH_A]: 'https://s3/a.png', [HASH_B]: 'https://s3/b.png' }));
    const importUrl = vi.fn(async (url: string) => `asset-of-${url.split('/').pop()}`);

    const done = await importFigmaImages({ token: TOKEN, fileKey: FILE, hashes: [HASH_A, HASH_B] }, { fetchFn, importUrl });

    expect(done).toEqual({ outcome: FigmaOutcome.Ok, assets: { [HASH_A]: 'asset-of-a.png', [HASH_B]: 'asset-of-b.png' } });
    expect(fetchFn).toHaveBeenCalledWith(`https://api.figma.com/v1/files/${FILE}/images`, { headers: { 'X-Figma-Token': TOKEN } });
  });

  it('skips an image that is missing from Figma or cannot be stored', async () => {
    const fetchFn = imagesOf({ [HASH_A]: 'https://s3/a.png' });

    const done = await importFigmaImages({ token: TOKEN, fileKey: FILE, hashes: [HASH_A, HASH_B] }, { fetchFn, importUrl: async () => null });

    expect(done).toEqual({ outcome: FigmaOutcome.Ok, assets: {} });
  });

  it('reports a rejected token', async () => {
    const done = await importFigmaImages({ token: TOKEN, fileKey: FILE, hashes: [HASH_A] }, { fetchFn: async () => answer(403, {}), importUrl: async () => 'x' });

    expect(done).toEqual({ outcome: FigmaOutcome.Rejected, assets: {} });
  });

  it('reports an unreachable Figma', async () => {
    const done = await importFigmaImages({ token: TOKEN, fileKey: FILE, hashes: [HASH_A] }, { fetchFn: async () => Promise.reject(new Error('down')), importUrl: async () => 'x' });

    expect(done.outcome).toBe(FigmaOutcome.Unavailable);
  });

  it('refuses a file key or a hash that is not one before calling Figma', async () => {
    const fetchFn = vi.fn();

    expect((await importFigmaImages({ token: TOKEN, fileKey: '../x', hashes: [HASH_A] }, { fetchFn, importUrl: async () => 'x' })).outcome).toBe(FigmaOutcome.Invalid);
    expect((await importFigmaImages({ token: TOKEN, fileKey: FILE, hashes: ['nope'] }, { fetchFn, importUrl: async () => 'x' })).outcome).toBe(FigmaOutcome.Invalid);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses more hashes than the cap', async () => {
    const many = Array.from({ length: MAX_HASHES + 1 }, (_, i) => i.toString(16).padStart(40, '0'));

    const done = await importFigmaImages({ token: TOKEN, fileKey: FILE, hashes: many }, { fetchFn: vi.fn(), importUrl: async () => 'x' });

    expect(done.outcome).toBe(FigmaOutcome.Invalid);
  });
});
