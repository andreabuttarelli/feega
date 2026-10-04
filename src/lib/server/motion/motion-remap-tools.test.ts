import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { REMAP_KEY, isRemapped } from '$lib/motion/time-remap';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('time remap tools', () => {
  it('sets speed and reverse, then a ramp in source seconds', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Video', start: 0, duration: 4 });
    expect(await run('set_time_remap', { clip_id: 'id1', speed: 2, reverse: true })).not.toHaveProperty('error');
    expect(findClip(session.doc, 'id1')!.clip.props).toMatchObject({ speed: 2, reverse: true });
    await run('set_time_remap', { clip_id: 'id1', keyframes: [{ time: 0, source: 0 }, { time: 2, source: 4 }] });
    expect(findClip(session.doc, 'id1')!.clip.keyframes[REMAP_KEY].map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [60, 4]
    ]);
  });

  it('freezes at a time and clears back to plain playback', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Video', start: 1, duration: 4 });
    await run('freeze_frame', { clip_id: 'id1', at: 2 });
    expect(findClip(session.doc, 'id1')!.clip.keyframes[REMAP_KEY]).toHaveLength(1);
    await run('set_time_remap', { clip_id: 'id1', clear: true });
    expect(isRemapped(findClip(session.doc, 'id1')!.clip)).toBe(false);
  });

  it('refuses a clip that is not a video', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    expect(await run('freeze_frame', { clip_id: 'id1', at: 0 })).toHaveProperty('error');
  });
});
