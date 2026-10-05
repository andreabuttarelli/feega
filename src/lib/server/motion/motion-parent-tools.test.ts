import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { ParentOpacity } from '$lib/motion/parent';
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

describe('motion agent parenting tools', () => {
  it('add_null places an invisible handle at a pivot, in seconds', async () => {
    const { session, run } = setup();
    const out = await run('add_null', { start: 1, duration: 4, x: 576, y: 648 });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip).toMatchObject({ component: 'Null', from: 30, durationInFrames: 120, props: { x: 0.3, y: 0.6 } });
  });

  it('set_parent keeps the child where it is and can ignore the parent opacity; a loop comes back as an error', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });
    await run('add_null', { start: 0, duration: 4 });
    await run('set_transform', { clip_id: 'id2', transform: { x: 192 } });

    const out = await run('set_parent', { clip_id: 'id1', parent_id: 'id2', inherit_opacity: false });
    const loop = await run('set_parent', { clip_id: 'id2', parent_id: 'id1' });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip).toMatchObject({ parent: 'id2', parentOpacity: ParentOpacity.Ignore, transform: { x: -0.1 } });
    expect(String(loop.error)).toContain('loop');

    await run('set_parent', { clip_id: 'id1', parent_id: null });
    expect(findClip(session.doc, 'id1')!.clip).toMatchObject({ parent: null, transform: { x: 0 } });
  });

  it('parent_clips without a parent makes a null at their centre and says its id', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4, props: { x: 384, y: 540, width: 192, height: 108 } });
    await run('add_clip', { component: 'Text', start: 0, duration: 4, props: { x: 1152, y: 540, width: 192, height: 108 } });
    const out = await run('parent_clips', { clip_ids: ['id1', 'id2'] });

    expect(out.null_id).toBe('id3');
    expect(findClip(session.doc, 'id3')!.clip.props).toMatchObject({ x: 0.4, y: 0.5 });
    expect(findClip(session.doc, 'id2')!.clip.parent).toBe('id3');
  });

  it('the doc the agent reads shows each parent', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    await run('add_null', { start: 0, duration: 3 });
    await run('set_parent', { clip_id: 'id1', parent_id: 'id2' });
    const doc = (await run('get_motion_doc', {})) as { tracks: { clips: { id: string; parent: string | null }[] }[] };

    expect(doc.tracks[0].clips.find((c) => c.id === 'id1')!.parent).toBe('id2');
  });

  it('the prompt teaches nulls and parenting', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });

    for (const name of ['add_null', 'set_parent', 'parent_clips']) {
      expect(prompt).toContain(name);
    }
  });
});
