import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

const IDENTITY_CUBE = ['LUT_3D_SIZE 2', '0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', '1 1 1'].join('\n');

describe('grading tools', () => {
  it('grades a clip with a LUT preset, adding the effect when it has none', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Image', start: 0 });
    const out = await run('set_lut', { clip_id: 'id1', preset: 'teal-orange', amount: 0.7 });
    expect(out).not.toHaveProperty('error');
    const effect = findClip(session.doc, 'id1')!.clip.effects[0];
    expect(effect).toMatchObject({ kind: 'lut', params: { amount: 0.7 } });
    expect(effect.lut?.name).toBe('teal-orange');
  });

  it('loads a .cube text into an existing LUT effect', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Image', start: 0 });
    await run('add_effect', { clip_id: 'id1', kind: 'lut' });
    await run('set_lut', { clip_id: 'id1', effect_id: 'id2', cube: IDENTITY_CUBE, name: 'mine' });
    expect(findClip(session.doc, 'id1')!.clip.effects[0].lut?.name).toBe('mine');
  });

  it('refuses a broken .cube with the reason', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Image', start: 0 });
    expect(await run('set_lut', { clip_id: 'id1', cube: 'nope' })).toMatchObject({ ok: false, error: expect.stringContaining('LUT_3D_SIZE') });
  });

  it('levels and lift/gamma/gain are plain effects the agent already adds', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Image', start: 0 });
    await run('add_effect', { clip_id: 'id1', kind: 'levels', params: { inBlack: 0.05 } });
    await run('add_effect', { clip_id: 'id1', kind: 'lift-gamma-gain', params: { gainB: 1.2 } });
    expect(findClip(session.doc, 'id1')!.clip.effects.map((e) => e.kind)).toEqual(['levels', 'lift-gamma-gain']);
  });
});
