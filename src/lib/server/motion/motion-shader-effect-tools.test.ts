import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup(assets: { id: string; kind: string }[] = []) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: assets as never, newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('add_shader_effect', () => {
  it('adds a mesh gradient with the agent colours', async () => {
    const { session, run } = setup();

    const result = await run('add_shader_effect', { effect: 'mesh-gradient', start: 0, duration: 4, props: { colorA: 'brand.primary', swirl: 0.6 } });

    expect(result).not.toHaveProperty('error');
    const clip = session.doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'ShaderEffect')!;
    expect(clip.props).toMatchObject({ effect: 'mesh-gradient', colorA: 'brand.primary', swirl: 0.6 });
  });

  it('refuses a knob the effect does not have', async () => {
    const { run } = setup();

    const result = await run('add_shader_effect', { effect: 'iris-wipe', start: 0, props: { radius: 1 } });

    expect(String(result.error)).toContain('iris-wipe has no radius');
  });

  it('refuses a number out of range', async () => {
    const { run } = setup();

    const result = await run('add_shader_effect', { effect: 'iris-wipe', start: 0, props: { progress: 3 } });

    expect(String(result.error)).toContain('progress takes 0..1');
  });

  it('keyframes a wipe progress', async () => {
    const { session, run } = setup();
    await run('add_shader_effect', { effect: 'iris-wipe', start: 0, duration: 2 });

    const keyed = await run('set_keyframes', { clip_id: 'id1', prop: 'progress', keyframes: [{ time: 0, value: 0 }, { time: 1.5, value: 1 }] });

    expect(keyed).not.toHaveProperty('error');
    expect(findClip(session.doc, 'id1')!.clip.keyframes.progress?.map((k) => k.value)).toEqual([0, 1]);
  });

  it('refuses keyframes on speed, fixed per clip', async () => {
    const { run } = setup();
    await run('add_shader_effect', { effect: 'plasma', start: 0, duration: 2 });

    const keyed = await run('set_keyframes', { clip_id: 'id1', prop: 'speed', keyframes: [{ time: 0, value: 0 }, { time: 1, value: 2 }] });

    expect(keyed).toHaveProperty('error');
  });

  it('refuses an unknown picture', async () => {
    const { run } = setup();

    const result = await run('add_shader_effect', { effect: 'fluted-glass', start: 0, image: 'nope' });

    expect(String(result.error)).toContain('unknown asset id');
  });
});
