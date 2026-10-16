import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { BreakdownError } from '$lib/server/video-reference';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup(videoBreakdown?: Parameters<typeof createMotionTools>[0]['videoBreakdown']) {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Square), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), videoBreakdown });
  return (input: unknown) => (tools.read_video_reference as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
}

describe('read_video_reference', () => {
  it('answers the breakdown of a reference video asset', async () => {
    const read = vi.fn(async (assetId: string) => ({ ok: true as const, assetId, breakdown: { durationS: 6 } as never, brief: 'Scenes: 1. 0–6 s' }));

    const out = await setup(read)({ asset_id: 'v-1' });

    expect(read).toHaveBeenCalledWith('v-1');
    expect(out).toMatchObject({ ok: true, brief: 'Scenes: 1. 0–6 s', breakdown: { durationS: 6 } });
  });

  it('says why when the asset is not a readable video', async () => {
    const read = async () => ({ ok: false as const, error: BreakdownError.NotVideo, message: 'That asset is not a video.' });

    expect(await setup(read)({ asset_id: 'img' })).toEqual({ ok: false, error: 'That asset is not a video.' });
  });

  it('outside a chat turn it refuses instead of pretending', async () => {
    expect((await setup()({ asset_id: 'v-1' })).ok).toBe(false);
  });
});

describe('compare_to_reference', () => {
  function compare(compareReference?: Parameters<typeof createMotionTools>[0]['compareReference']) {
    const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
    const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), compareReference });
    return (tools.compare_to_reference as Tool & { execute: Exec }).execute({}, { toolCallId: 'c-1' });
  }

  it('scores each scene against the reference and names the one to fix first', async () => {
    const out = await compare(async () => ({ scenes: [{ scene: 1, score: 0.9 }, { scene: 2, score: 0.4 }], times: [] }));

    expect(out).toMatchObject({ ok: true, scenes: [{ scene: 1, score: 0.9 }, { scene: 2, score: 0.4 }], fix_first: 2, close: false });
  });

  it('every scene at 0.9 or more is close; 0.87 is not (the failed Cautiva opening scored 0.87)', async () => {
    expect(await compare(async () => ({ scenes: [{ scene: 1, score: 0.92 }], times: [] }))).toMatchObject({ close: true });
    expect(await compare(async () => ({ scenes: [{ scene: 1, score: 0.87 }], times: [] }))).toMatchObject({ close: false });
  });

  it('without a reference it refuses instead of pretending', async () => {
    expect((await compare()).ok).toBe(false);
  });
});
