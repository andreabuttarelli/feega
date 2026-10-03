import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/repos/assets', () => ({
  findAssets: vi.fn(async () => new Map([
    ['a1', { id: 'a1', url: 'https://cdn.store.com/shirt.jpg', source: 'imported' }],
    ['a2', { id: 'a2', url: 'u1/media/one.png', source: 'generated' }]
  ]))
}));
const signAssetPaths = vi.fn(async (_u: unknown, _s: unknown, paths: { generated: string[]; uploaded: string[] }) => new Map([...paths.generated, ...paths.uploaded].map((p) => [p, `https://signed/${p}`])));
vi.mock('$lib/server/canvas/sign-media', () => ({ createAssetSigningDb: () => ({}), signAssetPaths }));

const { signedAssets } = await import('./studio-media');

describe('signedAssets', () => {
  it('an imported asset with an absolute URL is shown as is, never sent to storage signing', async () => {
    const { urls } = await signedAssets({} as never, 'org', ['a1', 'a2']);
    expect(urls).toEqual({ a1: 'https://cdn.store.com/shirt.jpg', a2: 'https://signed/u1/media/one.png' });
    expect(signAssetPaths.mock.calls[0][2]).toEqual({ generated: ['u1/media/one.png'], uploaded: [] });
  });
});
