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

describe('motion agent effect tools', () => {
  it('add_effect returns its id and the keys to animate; set_effect edits, reorders and toggles; remove_effect drops it', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 3 });

    const glow = await run('add_effect', { clip_id: 'id1', kind: 'glow', params: { radius: 40 } });
    expect(glow).toMatchObject({ ok: true, effect_id: 'id2', animate: expect.arrayContaining(['fx.id2.radius']) });
    await run('add_effect', { clip_id: 'id1', kind: 'black-white' });

    expect((await run('set_effect', { clip_id: 'id1', effect_id: 'id3', index: 0, enabled: false, params: { amount: 0.5 } })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.effects.map((e) => [e.id, e.enabled, e.params.amount ?? null])).toEqual([
      ['id3', false, 0.5],
      ['id2', true, null]
    ]);

    expect((await run('set_keyframes', { clip_id: 'id1', prop: 'fx.id2.radius', keyframes: [{ time: 0, value: 0 }, { time: 1, value: 60 }] })).ok).toBe(true);
    expect((await run('set_expression', { clip_id: 'id1', prop: 'fx.id2.intensity', expression: '0.6 + Math.sin(time * 4) * 0.3' })).ok).toBe(true);
    expect(JSON.stringify(await run('get_motion_doc', {}))).toContain('"kind":"glow"');

    expect((await run('remove_effect', { clip_id: 'id1', effect_id: 'id2' })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.keyframes).toEqual({});
    expect(String((await run('set_effect', { clip_id: 'id1', effect_id: 'id2', enabled: true })).error)).toContain('id3');
  });

  it('the prompt lists the effects', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });
    for (const needle of ['add_effect', 'drop-shadow', 'chromatic-aberration', 'fx.<effect id>.<param>']) {
      expect(prompt).toContain(needle);
    }
  });
});
