import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = {
    doc: newMotionDoc(MotionFormat.Landscape),
    baseVersion: 1,
    edits: [],
    selection: [],
    frames: new Map(),
    views: 0,
    checkedAt: 0,
    codeWrites: 0
  };
  const tools = createMotionTools({
    session,
    assets: [],
    newId: () => `id${++n}`,
    voiceover: vi.fn(),
    frames: vi.fn(),
    check: vi.fn()
  });
  const run = (name: string, input: unknown) =>
    (tools[name] as Tool & { execute: Exec }).execute(input, {
      toolCallId: 'c'
    });
  return { session, run };
}

describe('motion agent apply_preset', () => {
  it('fades a clip in at its start, in seconds', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });

    const out = await run('apply_preset', {
      clip_id: 'id1',
      preset: 'fade',
      side: 'in',
      duration: 1
    });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.keyframes.opacity.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [30, 1]
    ]);
  });

  it('starts at a time given from the clip start', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });

    await run('apply_preset', {
      clip_id: 'id1',
      preset: 'fade',
      side: 'out',
      at: 2,
      duration: 0.5
    });

    expect(findClip(session.doc, 'id1')!.clip.keyframes.opacity.map((k) => k.frame)).toEqual([60, 75]);
  });

  it('says why a preset is refused', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });

    expect(
      await run('apply_preset', {
        clip_id: 'id1',
        preset: 'typewriter',
        side: 'in'
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining('text') });
  });
});
