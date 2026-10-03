import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Square), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('motion agent keyframe tools', () => {
  it('set_keyframes takes clip-relative seconds and stores frames', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 1, duration: 3 });
    const out = await run('set_keyframes', {
      clip_id: 'id1',
      prop: 'rotateY',
      keyframes: [
        { time: 0, value: 0, ease: 'linear' },
        { time: 1.5, value: 360, ease: [0.2, 0.8, 0.2, 1] }
      ]
    });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.keyframes.rotateY).toEqual([
      { frame: 0, value: 0, ease: 'linear' },
      { frame: 45, value: 360, ease: [0.2, 0.8, 0.2, 1] }
    ]);
  });

  it('a prop the component cannot animate comes back with the ones it can', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    const out = await run('set_keyframes', { clip_id: 'id1', prop: 'orbit', keyframes: [{ time: 0, value: 1 }] });

    expect(out.ok).toBe(false);
    expect(String(out.error)).toContain('rotateY');
  });

  it('remove_keyframes drops a lane, or only the given times', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    await run('set_keyframes', { clip_id: 'id1', prop: 'scale', keyframes: [{ time: 0, value: 1 }, { time: 1, value: 2 }, { time: 2, value: 1 }] });
    await run('remove_keyframes', { clip_id: 'id1', prop: 'scale', times: [1] });

    expect(findClip(session.doc, 'id1')!.clip.keyframes.scale.map((k) => k.frame)).toEqual([0, 60]);

    await run('remove_keyframes', { clip_id: 'id1', prop: 'scale' });
    expect(findClip(session.doc, 'id1')!.clip.keyframes).toEqual({});
  });

  it('set_transform merges base values', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Image', start: 0 });
    await run('set_transform', { clip_id: 'id1', transform: { rotateX: 20, perspective: 800 } });

    expect(findClip(session.doc, 'id1')!.clip.transform).toEqual({ rotateX: 20, perspective: 800 });
  });

  it('the doc the agent reads shows transform and keyframes in seconds', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    await run('set_keyframes', { clip_id: 'id1', prop: 'opacity', keyframes: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }] });
    const doc = (await run('get_motion_doc', {})) as { tracks: { clips: { keyframes: Record<string, { time: number }[]> }[] }[] };

    expect(doc.tracks[0].clips[0].keyframes.opacity.map((k) => k.time)).toEqual([0, 0.5]);
  });

  it('the catalogue lists what each component animates', async () => {
    const { run } = setup();
    const catalogue = (await run('list_components', {})) as unknown as { id: string; animates: string[] }[];

    expect(catalogue.find((c) => c.id === 'Model3D')!.animates).toContain('orbit');
  });

  it('the prompt tells the agent how to animate', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });

    expect(prompt).toContain('set_keyframes');
    expect(prompt).toContain('set_transform');
  });
});
