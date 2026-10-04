import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { AssetKind } from '$lib/motion/components';
import { ANALYSIS_VERSION, type AudioAnalysis } from '$lib/motion/audio-analysis';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const voice: AudioAnalysis = { version: ANALYSIS_VERSION, fps: 30, duration: 4, amp: [], onsets: [0.5], bpm: null, beats: [], speech: [{ start: 1, end: 2 }] };
const music: AudioAnalysis = { version: ANALYSIS_VERSION, fps: 30, duration: 10, amp: [], onsets: [0, 0.5], bpm: 120, beats: [0, 0.5, 1], speech: [] };

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Square), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const assets = ['vo', 'music'].map((id) => ({ id, kind: AssetKind.Audio, label: id, previewUrl: '', url: `https://x/${id}` }));
  const analysis = vi.fn(async (id: string) => ({ vo: voice, music })[id] ?? null);
  const tools = createMotionTools({ session, assets, newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), analysis });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('motion agent audio tools', () => {
  it('analyze_audio reports tempo, beats, onsets and speech of an asset', async () => {
    const { run } = setup();
    const out = await run('analyze_audio', { asset_id: 'music' });

    expect(out).toMatchObject({ ok: true, bpm: 120, beats: [0, 0.5, 1], onsets: [0, 0.5], speech: [] });
  });

  it('analyze_audio refuses an asset it cannot analyse', async () => {
    const { run } = setup();
    expect((await run('analyze_audio', { asset_id: 'nope' })).ok).toBe(false);
  });

  it('duck_audio ducks only where the voice speaks', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Audio', start: 0, duration: 10, props: { assetId: 'music', volume: 1 } });
    await run('add_track', { kind: 'audio' });
    await run('add_clip', { component: 'Audio', start: 2, duration: 4, track_id: 'id2', props: { assetId: 'vo' } });
    const out = await run('duck_audio', { music_clip_id: 'id1', voice_clip_id: 'id3' });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.keyframes.volume.map((k) => k.frame)).toEqual([0, 84, 90, 120, 132]);
  });
});

describe('motion agent beat tools', () => {
  async function withMusic() {
    const kit = setup();
    await kit.run('add_clip', { component: 'Audio', start: 1, duration: 8, props: { assetId: 'music' } });
    return kit;
  }

  it('beat_times gives the beats of the music on the timeline, in seconds', async () => {
    const { run } = await withMusic();
    const out = await run('beat_times', { hit: 'beats' });

    expect(out).toMatchObject({ ok: true, times: [1, 1.5, 2] });
  });

  it('cut_to_beat re-times the clips so every cut lands on a beat', async () => {
    const { session, run } = await withMusic();
    await run('add_clip', { component: 'Shape', start: 1.1, duration: 0.4 });
    await run('add_clip', { component: 'Shape', start: 1.5, duration: 0.6 });
    const out = await run('cut_to_beat', { clip_ids: ['id2', 'id3'] });
    const span = (id: string) => {
      const c = findClip(session.doc, id)!.clip;
      return [c.from, c.from + c.durationInFrames];
    };

    expect(out.ok).toBe(true);
    expect([span('id2'), span('id3')]).toEqual([
      [30, 45],
      [45, 60]
    ]);
  });
});
