import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { SAMPLE_RATE } from '$lib/motion/sound/score';
import { decodeWav } from '$lib/motion/sound/wav';

const world = vi.hoisted(() => ({ uploads: [] as { path: string; blob: Blob }[], inserted: [] as Record<string, unknown>[], saved: [] as Record<string, unknown>[], head: null as unknown }));

vi.mock('$lib/server/repos/assets', () => ({
  insertAsset: async (_db: unknown, input: Record<string, unknown>) => {
    world.inserted.push(input);
    return { id: 'snd', url: input.url };
  }
}));
vi.mock('$lib/server/canvas/sign-media', () => ({
  createAssetSigningDb: () => ({}),
  signAssetPaths: async (_db: unknown, _s: unknown, paths: { uploaded: string[] }) => new Map(paths.uploaded.map((p) => [p, `https://signed/${p}`]))
}));
vi.mock('$lib/server/repos/canvas', () => ({ findNode: async () => ({ id: 'n', projectId: 'p', type: 'motion', data: { format: 'square' } }) }));
vi.mock('$lib/canvas/motion-node', () => ({ motionOf: () => ({ format: 'square' }) }));
vi.mock('$lib/server/repos/motion-revisions', () => ({ RevisionOutcome: { Written: 'written' } }));
vi.mock('./editor', () => ({
  headOrNew: async () => world.head,
  saveMotionDoc: async (_db: unknown, input: Record<string, unknown>) => {
    world.saved.push(input);
    return { outcome: 'written', head: { version: 4, doc: input.doc } };
  }
}));

const { storeSound, writeSound } = await import('./sound');

const db = { storage: { from: () => ({ upload: async (path: string, blob: Blob) => (world.uploads.push({ path, blob }), { error: null }) }) } } as never;
const score = { voices: [{ id: 'hit', instrument: 'hit' }], events: [{ voice: 'hit', at: 0.5, duration: 0.4 }] };

describe('sound design storage', () => {
  beforeEach(() => {
    world.uploads = [];
    world.inserted = [];
    world.saved = [];
    world.head = { version: 3, doc: newMotionDoc(MotionFormat.Square) };
  });

  it('stores the render as a WAV asset of the exact length', async () => {
    const out = await storeSound(db, { orgId: 'o', projectId: 'p', nodeId: 'n' }, { seed: 1, voices: [{ id: 'hit', instrument: 'hit', gain: 0.6, pan: 0, reverb: 0, brightness: 0.5 }], events: [{ voice: 'hit', at: 0.5, duration: 0.4, velocity: 0.8 }] } as never, 2);

    expect(out).toMatchObject({ ok: true, assetId: 'snd', seconds: 2 });
    expect(world.uploads[0].path).toMatch(/^o\/p\/sound\/.+\.wav$/);
    expect(world.inserted[0]).toMatchObject({ type: 'audio', mimeType: 'audio/wav', durationS: 2 });
    const wav = decodeWav(new Uint8Array(await world.uploads[0].blob.arrayBuffer()));
    expect(wav.left.length).toBe(2 * SAMPLE_RATE);
  });

  it('writes a score through the API onto the head revision', async () => {
    const out = await writeSound(db, { orgId: 'o', userId: 'u', nodeId: 'n' }, score);

    expect(out).toMatchObject({ ok: true, version: 4, asset_id: 'snd', events: 1 });
    expect(world.saved[0]).toMatchObject({ expectedVersion: 3 });
    expect((world.saved[0].doc as { sound: { assetId: string } }).sound.assetId).toBe('snd');
  });

  it('refuses a malformed score with 400', async () => {
    const out = await writeSound(db, { orgId: 'o', userId: 'u', nodeId: 'n' }, { voices: [], events: [] });

    expect(out instanceof Response && out.status).toBe(400);
    expect(world.uploads).toEqual([]);
  });
});
