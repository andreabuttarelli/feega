import { describe, expect, it, vi } from 'vitest';
import { Sfx } from '$lib/motion/sfx';

const world = vi.hoisted(() => ({ uploads: [] as string[], inserted: [] as Record<string, unknown>[] }));

vi.mock('$app/server', () => ({ read: () => new Response(new Uint8Array([1, 2, 3])) }));
vi.mock('$lib/server/repos/assets', () => ({
  insertAsset: async (_db: unknown, input: Record<string, unknown>) => {
    world.inserted.push(input);
    return { id: 'sfx-asset' };
  }
}));
vi.mock('$lib/server/canvas/sign-media', () => ({
  createAssetSigningDb: () => ({}),
  signAssetPaths: async (_db: unknown, _s: unknown, paths: { uploaded: string[] }) => new Map(paths.uploaded.map((p) => [p, `https://signed/${p}`]))
}));

const { laySfx } = await import('./sfx');

const db = { storage: { from: () => ({ upload: async (path: string) => (world.uploads.push(path), { error: null }) }) } } as never;
const scope = { orgId: 'o', projectId: 'p', nodeId: 'n', userId: 'u', actor: { kind: 'agent', id: 'u' } as never };

describe('laySfx', () => {
  it('uploads the bundled click into the project and registers it as an audio asset', async () => {
    const out = await laySfx(db, scope, Sfx.Click);

    expect(out).toMatchObject({ ok: true, assetId: 'sfx-asset' });
    expect(world.uploads).toEqual([expect.stringMatching(/^o\/p\/sfx\/.+-click\.mp3$/)]);
    expect(world.inserted[0]).toMatchObject({ type: 'audio', source: 'upload', mimeType: 'audio/mpeg' });
  });
});
