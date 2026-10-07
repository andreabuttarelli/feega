import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Mood } from '$lib/motion/music-library';

const world = vi.hoisted(() => ({ provider: null as unknown, uploads: [] as string[], inserted: [] as Record<string, unknown>[], sounds: [] as unknown[] }));

vi.mock('$lib/server/elevenlabs-config', () => ({ configuredAudioProvider: () => world.provider }));
vi.mock('./music-files', () => ({ libraryBytes: async () => new Uint8Array([1, 2, 3]) }));
vi.mock('./voiceover', () => ({
  Sound: { Music: 'music' },
  generateSound: async (...args: unknown[]) => {
    world.sounds.push(args);
    return { ok: true, assetId: 'gen', seconds: 15, url: 'https://x/gen' };
  }
}));
vi.mock('$lib/server/repos/assets', () => ({
  insertAsset: async (_db: unknown, input: Record<string, unknown>) => {
    world.inserted.push(input);
    return { id: 'lib', url: input.url, durationS: input.durationS };
  }
}));
vi.mock('$lib/server/canvas/sign-media', () => ({
  createAssetSigningDb: () => ({}),
  signAssetPaths: async (_db: unknown, _s: unknown, paths: { uploaded: string[] }) => new Map(paths.uploaded.map((p) => [p, `https://signed/${p}`]))
}));

const { layMusic } = await import('./music');

const db = { storage: { from: () => ({ upload: async (path: string) => (world.uploads.push(path), { error: null }) }) } } as never;
const scope = { orgId: 'o', projectId: 'p', nodeId: 'n', userId: 'u', actor: { kind: 'agent', id: 'u' } as never };

describe('layMusic', () => {
  beforeEach(() => {
    world.provider = null;
    world.uploads = [];
    world.inserted = [];
    world.sounds = [];
  });

  it('without a music generator lays the CC0 library track of the mood', async () => {
    const out = await layMusic(db, scope, { mood: Mood.Energetic, bpm: 126, seconds: 15 });

    expect(out).toMatchObject({ ok: true, assetId: 'lib', source: 'library', track: 'drive-128' });
    expect(out.ok && out.url).toMatch(/^https:\/\/signed\/o\/p\/music\/.+-drive-128\.mp3$/);
    expect(world.uploads).toEqual([expect.stringMatching(/^o\/p\/music\/.+-drive-128\.mp3$/)]);
    expect(world.inserted[0]).toMatchObject({ type: 'audio', source: 'upload', mimeType: 'audio/mpeg' });
    expect(world.sounds).toEqual([]);
  });

  it('with ElevenLabs configured composes a track instead', async () => {
    world.provider = {};
    const out = await layMusic(db, scope, { mood: Mood.Calm, seconds: 15 });

    expect(out).toMatchObject({ ok: true, assetId: 'gen', source: 'generated' });
    expect(world.uploads).toEqual([]);
  });
});
