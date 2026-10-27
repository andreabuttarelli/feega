import { describe, expect, it, vi } from 'vitest';
import { ImagesOutcome, figmaImageAssets } from './fetch-images';
import { ConnectionError } from '../connection-messages';

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('asking the server for the images of a Figma paste', () => {
  it('posts the file key and the distinct hashes, and returns hash to asset', async () => {
    const fetchFn = vi.fn(async () => answer(200, { assets: { aa: 'asset-1' } }));

    const got = await figmaImageAssets({ projectId: 'p1', fileKey: 'FILE', hashes: ['aa', 'aa', 'bb'] }, fetchFn);

    expect(got).toEqual({ outcome: ImagesOutcome.Filled, error: null, assets: { aa: 'asset-1' } });
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/projects/p1/figma-images', expect.objectContaining({ method: 'POST', body: JSON.stringify({ fileKey: 'FILE', hashes: ['aa', 'bb'] }) }));
  });

  it('tells a missing token apart from any other failure', async () => {
    expect((await figmaImageAssets({ projectId: 'p1', fileKey: 'F', hashes: ['aa'] }, async () => answer(409, { error: 'no_token' }))).outcome).toBe(ImagesOutcome.NoToken);
    expect((await figmaImageAssets({ projectId: 'p1', fileKey: 'F', hashes: ['aa'] }, async () => answer(502, {}))).outcome).toBe(ImagesOutcome.Failed);
  });

  it.each([
    [422, 'token_rejected', ConnectionError.TokenRejected],
    [429, 'rate_limited', ConnectionError.RateLimited],
    [502, 'unavailable', ConnectionError.Unavailable],
    [400, 'invalid', ConnectionError.Invalid]
  ])('says why a %s failed', async (status, error, kind) => {
    const got = await figmaImageAssets({ projectId: 'p1', fileKey: 'F', hashes: ['aa'] }, async () => answer(status, { error }));

    expect(got).toMatchObject({ outcome: ImagesOutcome.Failed, error: kind });
  });

  it('a network error leaves the placeholders, it does not throw', async () => {
    const got = await figmaImageAssets({ projectId: 'p1', fileKey: 'F', hashes: ['aa'] }, async () => Promise.reject(new Error('offline')));

    expect(got).toEqual({ outcome: ImagesOutcome.Failed, error: ConnectionError.Unavailable, assets: {} });
  });
});
