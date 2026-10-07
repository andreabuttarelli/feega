import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, clipsOf, newMotionDoc } from '$lib/motion/doc';
import { AssetKind } from '$lib/motion/components';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup(deps: Partial<MotionToolDeps> = {}) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const assets: MotionToolDeps['assets'] = [];
  const tools = createMotionTools({ session, assets, newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), ...deps });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, assets, run };
}

describe('generate_music', () => {
  it('generates a music bed and places it on an Audio clip', async () => {
    const music = vi.fn(async () => ({ ok: true as const, assetId: 'bed', seconds: 15, url: 'https://x/bed' }));
    const { session, assets, run } = setup({ music });

    const out = await run('generate_music', { prompt: 'calm electronic, 100 bpm, no vocals', seconds: 15 });

    expect(music).toHaveBeenCalledWith({ text: 'calm electronic, 100 bpm, no vocals', seconds: 15 });
    expect(out.ok).toBe(true);
    expect(assets.map((a) => a.id)).toEqual(['bed']);
    expect(clipsOf(session.doc).find((c) => c.component === 'Audio')?.props.assetId).toBe('bed');
  });

  it('says which license the music carries when it is the CC0 bed', async () => {
    const music = vi.fn(async () => ({ ok: true as const, assetId: 'bed', seconds: 15, url: 'https://x/bed', license: 'CC0 1.0' }));
    const { run } = setup({ music });

    expect(await run('generate_music', { prompt: 'beat', seconds: 15 })).toMatchObject({ ok: true, license: 'CC0 1.0', asset_id: 'bed' });
  });

  it('says so when this workspace cannot make music', async () => {
    const { run } = setup();

    expect((await run('generate_music', { prompt: 'piano', seconds: 10 })).ok).toBe(false);
  });
});
