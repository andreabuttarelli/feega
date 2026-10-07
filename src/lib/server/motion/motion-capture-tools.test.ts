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

const shot = (id: string) => ({ ok: true as const, width: 1920, height: 1080, asset: { id, kind: AssetKind.Image, label: id, previewUrl: '', url: `https://x/${id}` } });

describe('capture_site', () => {
  it('imports the screenshots of a real browser as project pictures, top of the page first', async () => {
    const capture = vi.fn(async () => ({ ok: true as const, shots: [shot('top'), shot('features')] }));
    const { assets, run } = setup({ capture });

    const out = await run('capture_site', { url: 'https://dub.co' });

    expect(capture).toHaveBeenCalledWith('https://dub.co');
    expect(out).toMatchObject({ ok: true, screenshots: [{ asset_id: 'top', width: 1920, height: 1080 }, { asset_id: 'features' }] });
    expect(assets.map((a) => a.id)).toEqual(['top', 'features']);
  });

  it('says so when this workspace cannot capture sites', async () => {
    const { run } = setup();

    expect((await run('capture_site', { url: 'https://dub.co' })).ok).toBe(false);
  });

  it('passes a failed capture on as an error', async () => {
    const { run } = setup({ capture: vi.fn(async () => ({ ok: false as const, error: 'capture did not finish in 360 s' })) });

    expect(await run('capture_site', { url: 'https://dub.co' })).toEqual({ ok: false, error: 'capture did not finish in 360 s' });
  });
});

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

  it('says so when this workspace cannot make music', async () => {
    const { run } = setup();

    expect((await run('generate_music', { prompt: 'piano', seconds: 10 })).ok).toBe(false);
  });
});
