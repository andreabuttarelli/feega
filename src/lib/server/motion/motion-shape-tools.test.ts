import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { FEEGA_TOKENS } from '$lib/motion/brand';
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

describe('motion agent shape tools', () => {
  it('draws a star, morphs it into a path, draws it on with trim paths and repeats it, all in the render', async () => {
    const { session, run } = setup();
    expect(await run('add_shape', { kind: 'star', start: 0, duration: 4, props: { fillKind: 'linear', fill: '#ff0000', fill2: '#0000ff', width: 0.3, height: 0.3 } })).toMatchObject({ ok: true, clip_id: 'id1' });
    expect((await run('morph_to', { clip_id: 'id1', path: 'M0 0L1 0L1 1L0 1Z', start: 0, end: 2 })).ok).toBe(true);
    const trim = await run('add_modifier', { clip_id: 'id1', kind: 'trim' });
    expect(trim).toMatchObject({ ok: true, modifier_id: 'id2', animate: ['mod.id2.start', 'mod.id2.end', 'mod.id2.offset'] });
    expect((await run('set_keyframes', { clip_id: 'id1', prop: 'mod.id2.end', keyframes: [{ time: 0, value: 0, ease: 'linear' }, { time: 1, value: 1, ease: 'linear' }] })).ok).toBe(true);
    expect((await run('add_modifier', { clip_id: 'id1', kind: 'repeater', params: { copies: 6, rotation: 60, offsetX: 0 } })).ok).toBe(true);
    expect((await run('set_modifier', { clip_id: 'id1', modifier_id: 'id3', params: { copies: 8 } })).ok).toBe(true);

    const html = composeHtml({ doc: session.doc, tokens: FEEGA_TOKENS, assets: {} });
    expect(html).toContain('<svg id="sv-id1"');
    expect(html).toContain("addEventListener('hf-seek'");
    expect(html).toContain('linearGradient');

    expect((await run('remove_modifier', { clip_id: 'id1', modifier_id: 'id2' })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.keyframes['mod.id2.end']).toBeUndefined();
  });

  it('set_path refuses markup and names what path data takes', async () => {
    const { run } = setup();
    await run('add_shape', { kind: 'rect', start: 0 });
    const out = await run('set_path', { clip_id: 'id1', path: 'M0 0 <script>alert(1)</script>' });
    expect(out.ok).toBe(false);
    expect(String(out.error)).toContain('path data');
  });

  it('the prompt tells the agent shapes exist', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });
    expect(prompt).toContain('add_shape');
    expect(prompt).toContain('add_modifier');
  });
});
