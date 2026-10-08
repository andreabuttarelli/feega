import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { INTERACTIVE_PRESETS } from '$lib/motion/interactive/presets';
import { Outside, PlayMode } from '$lib/motion/interactive/settings';
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

describe('motion agent interactive tools', () => {
  it('set_expression accepts live input and the video keeps its defaults', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });

    expect((await run('set_expression', { clip_id: 'id1', prop: 'rotateY', expression: '(input.smooth(input.pointer.x, 0.15) - 0.5) * 30' })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.expressions.rotateY).toContain('input.pointer.x');
  });

  it.each(INTERACTIVE_PRESETS)('apply_interactive_preset %s lands on the doc', async (preset) => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });

    const out = await run('apply_interactive_preset', { preset, clip_id: 'id1' });

    expect(out.ok).toBe(true);
    const clip = findClip(session.doc, 'id1')!.clip;
    expect(Object.values(clip.expressions).join() + JSON.stringify(session.doc.interactive ?? {})).toMatch(/input\.|scrub/);
  });

  it('set_interactive stores playback, loop and the outside rule, and get_motion_doc shows them', async () => {
    const { session, run } = setup();

    await run('set_interactive', { playback: PlayMode.InView, loop: false, outside: Outside.Hold });

    expect(session.doc.interactive).toEqual({ playback: PlayMode.InView, loop: false, outside: Outside.Hold });
    expect((await run('get_motion_doc', {})).interactive).toEqual(session.doc.interactive);
  });

  it('export_interactive reports what reacts live and the embed snippet', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });
    await run('apply_interactive_preset', { preset: 'card-tilt', clip_id: 'id1' });

    const out = await run('export_interactive', {});

    expect(out.ok).toBe(true);
    expect(out.live).toEqual(expect.arrayContaining([{ clip_id: 'id1', prop: 'rotateY' }]));
    expect(String(out.snippet)).toContain('<iframe');
  });

  it('publish_embed hosts the clip and returns the snippet; unpublish takes it down', async () => {
    const embed = vi.fn(async (action: string) => ({ ok: true, action, snippet: '<iframe src="https://oh.feega.app/e/n"></iframe>' }));
    const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
    const tools = createMotionTools({ session, assets: [], newId: () => 'x', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), embed });
    const run = (input: unknown) => (tools.publish_embed as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });

    expect(await run({})).toMatchObject({ ok: true, action: 'publish' });
    expect(await run({ action: 'unpublish' })).toMatchObject({ action: 'unpublish' });
  });

  it('publish_embed without hosting says so', async () => {
    const { run } = setup();

    expect(await run('publish_embed', {})).toMatchObject({ ok: false });
  });

  it('the prompt teaches live input and the interactive export', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });

    expect(prompt).toContain('input.pointer.x');
    expect(prompt).toContain('export_interactive');
  });
});
