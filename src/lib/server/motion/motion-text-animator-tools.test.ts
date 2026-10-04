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

describe('motion agent text animator tools', () => {
  it('apply_text_preset adds an animated selector in seconds; set and remove edit it; the doc shows it', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 1, duration: 3, props: { text: 'Hello world' } });

    const out = await run('apply_text_preset', { clip_id: 'id1', preset: 'blur-up', start: 0, duration: 1 });
    expect(out).toMatchObject({ ok: true, animator_id: 'id2' });
    expect(findClip(session.doc, 'id1')!.clip.keyframes['ta.id2.offset']).toEqual([
      { frame: 0, value: -40, ease: 'linear' },
      { frame: 30, value: 135, ease: 'linear' }
    ]);
    expect(JSON.stringify(await run('get_motion_doc', {}))).toContain('"unit":"char"');

    expect((await run('set_text_animator', { clip_id: 'id1', animator_id: 'id2', values: { rotation: 20 }, seed: 3 })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.animators[0]).toMatchObject({ seed: 3, values: { rotation: 20 } });
    expect((await run('remove_text_animator', { clip_id: 'id1', animator_id: 'id2' })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.animators).toEqual([]);
  });

  it('add_text_animator builds a custom one; keys come back for set_keyframes', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Text', start: 0, duration: 2 });
    const out = await run('add_text_animator', { clip_id: 'id1', unit: 'word', shape: 'smooth', values: { opacity: 0, scale: 0.6 } });

    expect(out).toMatchObject({ ok: true, animator_id: 'id2', animate: expect.arrayContaining(['ta.id2.offset', 'ta.id2.scale']) });
  });

  it('the prompt teaches text animators', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });
    for (const needle of ['add_text_animator', 'apply_text_preset', 'blur-up']) {
      expect(prompt).toContain(needle);
    }
  });
});
