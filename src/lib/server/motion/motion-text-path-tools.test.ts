import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { PATH_PRESETS } from '$lib/motion/text-path/model';
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

describe('motion agent text path tools', () => {
  it('every preset is reachable; set_text_path merges, get_motion_doc reads it back, remove_text_path drops it', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 3, props: { text: 'Around' } });

    for (const preset of PATH_PRESETS) {
      expect(await run('set_text_path', { clip_id: 'id1', preset })).toMatchObject({ ok: true });
    }
    const out = await run('set_text_path', { clip_id: 'id1', preset: 'circle', align: 'center', reverse: true, radius: 320 });
    expect(out).toMatchObject({ ok: true, animate: expect.arrayContaining(['tp.firstMargin', 'tp.radius']) });
    expect(findClip(session.doc, 'id1')!.clip.textPath).toMatchObject({ source: { kind: 'preset', preset: 'circle' }, align: 'center', reverse: true, radius: 320 });
    expect(JSON.stringify(await run('get_motion_doc', {}))).toContain('"textPath":{"source":{"kind":"preset","preset":"circle"}');

    await run('set_keyframes', { clip_id: 'id1', prop: 'tp.firstMargin', keyframes: [{ time: 0, value: 0 }, { time: 2, value: 100 }] });
    expect(findClip(session.doc, 'id1')!.clip.keyframes['tp.firstMargin']).toHaveLength(2);

    expect(await run('remove_text_path', { clip_id: 'id1' })).toMatchObject({ ok: true });
    expect(findClip(session.doc, 'id1')!.clip).toMatchObject({ textPath: null, keyframes: {} });
  });

  it('a shape clip can lend its path', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 3 });
    await run('add_clip', { component: 'Shape', start: 0, duration: 3, props: { shape: 'star' } });

    expect(await run('set_text_path', { clip_id: 'id1', shape_clip_id: 'id2' })).toMatchObject({ ok: true });
    expect(findClip(session.doc, 'id1')!.clip.textPath!.source).toEqual({ kind: 'clip', clip: 'id2' });
    expect(await run('set_text_path', { clip_id: 'id1', shape_clip_id: 'id2', preset: 'line' })).toMatchObject({ ok: false });
  });

  it('the prompt teaches text on a path', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });
    expect(prompt).toContain('set_text_path');
  });
});
