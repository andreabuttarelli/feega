import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('motion agent expression tool', () => {
  it('set_expression drives a clip property and shows in the summary; null removes it', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });

    const out = await run('set_expression', { clip_id: 'id1', prop: 'rotateZ', expression: 'time * 90' });
    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.expressions).toEqual({ rotateZ: 'time * 90' });
    expect(JSON.stringify(await run('get_motion_doc', {}))).toContain('time * 90');

    await run('set_expression', { clip_id: 'id1', prop: 'rotateZ', expression: null });
    expect(findClip(session.doc, 'id1')!.clip.expressions).toEqual({});
  });

  it('set_expression on the camera, and a broken expression comes back as an error', async () => {
    const { session, run } = setup();
    await run('set_camera', { enabled: true });

    expect((await run('set_expression', { camera: true, prop: 'rotateZ', expression: 'wiggle(5, 1.5)' })).ok).toBe(true);
    expect(session.doc.camera!.expressions).toEqual({ rotateZ: 'wiggle(5, 1.5)' });
    expect(String((await run('set_expression', { clip_id: 'nope', prop: 'x', expression: 'value' })).error)).toContain('nope');
    expect(String((await run('set_expression', { camera: true, prop: 'x', expression: 'time *' })).error)).toContain('x');
  });

  it('the prompt teaches the expression language with shake, rotation and follow examples', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });
    for (const needle of ['set_expression', 'wiggle(', 'time * ', 'layer("']) {
      expect(prompt).toContain(needle);
    }
  });
});
