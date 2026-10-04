import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Square), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
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
    const catalogue = ((await run('list_components', {})) as unknown as { library: { id: string; animates: string[] }[] }).library;

    expect(catalogue.find((c) => c.id === 'Model3D')!.animates).toContain('orbit');
  });

  it('the prompt tells the agent how to animate', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });

    expect(prompt).toContain('set_keyframes');
    expect(prompt).toContain('set_transform');
  });
});

describe('motion agent keyframe interpolation', () => {
  it('set_keyframes takes in/out kinds and roving per keyframe', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 3 });
    const out = await run('set_keyframes', {
      clip_id: 'id1',
      prop: 'x',
      keyframes: [
        { time: 0, value: 0, out: 'auto' },
        { time: 1, value: 0.1, in: 'auto', out: 'hold', roving: true },
        { time: 2, value: 0.3, in: 'linear' }
      ]
    });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.keyframes.x.map((k) => [k.in, k.out, k.roving])).toEqual([
      [undefined, 'auto', undefined],
      ['auto', 'hold', true],
      ['linear', undefined, undefined]
    ]);
  });

  it('set_key_interpolation changes keyframes already there, all or only at the given times', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 3 });
    await run('set_keyframes', { clip_id: 'id1', prop: 'scale', keyframes: [{ time: 0, value: 1 }, { time: 1, value: 2 }, { time: 2, value: 1 }] });
    const out = await run('set_key_interpolation', { clip_id: 'id1', prop: 'scale', times: [1], out: 'hold' });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.keyframes.scale.map((k) => k.out)).toEqual([undefined, 'hold', undefined]);
  });

  it('get_motion_doc shows the interpolation of each keyframe', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 3 });
    await run('set_keyframes', { clip_id: 'id1', prop: 'x', keyframes: [{ time: 0, value: 0, out: 'continuous' }, { time: 1, value: 0.2, roving: true }, { time: 2, value: 0.4 }] });
    const doc = (await run('get_motion_doc', {})) as { tracks: { clips: { keyframes: Record<string, Record<string, unknown>[]> }[] }[] };
    const keys = doc.tracks[0].clips[0].keyframes.x;

    expect(keys[0]).toMatchObject({ out: 'continuous' });
    expect(keys[1]).toMatchObject({ roving: true });
  });
});

describe('motion agent graph tools', () => {
  async function keyed() {
    const t = setup();
    await t.run('add_clip', { component: 'Title', start: 0, duration: 3 });
    await t.run('set_keyframes', { clip_id: 'id1', prop: 'rotateZ', keyframes: [{ time: 0, value: 0, ease: 'standard' }, { time: 1, value: 90, ease: 'standard' }, { time: 2, value: 0, ease: 'standard' }] });
    return t;
  }

  it('apply_ease_preset easy-eases the keyframes at the given times', async () => {
    const { session, run } = await keyed();
    const out = await run('apply_ease_preset', { clip_id: 'id1', prop: 'rotateZ', times: [1], preset: 'easy-ease' });

    expect(out.ok).toBe(true);
    const track = findClip(session.doc, 'id1')!.clip.keyframes.rotateZ;
    expect((track[1].ease as number[]).slice(0, 2)).toEqual([1 / 3, 0]);
  });

  it('set_ease_handles takes influence in percent and speed in units per second', async () => {
    const { session, run } = await keyed();
    const out = await run('set_ease_handles', { clip_id: 'id1', prop: 'rotateZ', time: 0, out_influence: 50, out_speed: 0, in_influence: 25, in_speed: 90 });

    expect(out.ok).toBe(true);
    const ease = findClip(session.doc, 'id1')!.clip.keyframes.rotateZ[0].ease as number[];
    expect(ease[0]).toBeCloseTo(0.5, 9);
    expect(ease[1]).toBeCloseTo(0, 9);
    expect(ease[2]).toBeCloseTo(0.75, 9);
    expect(ease[3]).toBeCloseTo(1 - (90 * 0.25 * 30) / (90 * 30), 9);
  });

  it('set_ease_handles on the last keyframe says there is no segment after it', async () => {
    const { run } = await keyed();
    const out = await run('set_ease_handles', { clip_id: 'id1', prop: 'rotateZ', time: 2, out_influence: 50 });
    expect(out.ok).toBe(false);
  });
});

describe('motion agent paths', () => {
  it('set_motion_path turns x/y keys into a curved path, and set_path_tangent bends it', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 3 });
    await run('set_keyframes', { clip_id: 'id1', prop: 'x', keyframes: [{ time: 0, value: -0.3, ease: 'linear' }, { time: 2, value: 0.3, ease: 'linear' }] });
    await run('set_keyframes', { clip_id: 'id1', prop: 'y', keyframes: [{ time: 0, value: 0, ease: 'linear' }, { time: 2, value: 0, ease: 'linear' }] });

    expect((await run('set_motion_path', { clip_id: 'id1', enabled: true, auto_orient: true })).ok).toBe(true);
    expect((await run('set_path_tangent', { clip_id: 'id1', time: 0, out: [0.2, -0.3] })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.path).toEqual({ autoOrient: true, tangents: [{ frame: 0, in: [0, 0], out: [0.2, -0.3] }] });
  });
});

describe('motion agent timeline organisation', () => {
  async function three() {
    const t = setup();
    await t.run('add_clip', { component: 'Title', start: 0, duration: 1 });
    await t.run('add_clip', { component: 'Title', start: 0.5, duration: 1 });
    await t.run('add_clip', { component: 'Title', start: 2, duration: 1 });
    return t;
  }

  it('markers are set by label and clips move to them by name', async () => {
    const { session, run } = await three();
    expect((await run('set_marker', { label: 'Drop', time: 4 })).ok).toBe(true);
    expect((await run('move_clip', { clip_id: 'id3', marker: 'Drop' })).ok).toBe(true);
    expect(findClip(session.doc, 'id3')!.clip.from).toBe(120);
    expect((await run('move_clip', { clip_id: 'id3', marker: 'Nope' })).ok).toBe(false);
  });

  it('arrange_clips sequences and staggers the given clips', async () => {
    const { session, run } = await three();
    expect((await run('arrange_clips', { clip_ids: ['id1', 'id2', 'id3'], op: 'stagger', seconds: 0.2 })).ok).toBe(true);
    expect(['id1', 'id2', 'id3'].map((id) => findClip(session.doc, id)!.clip.from)).toEqual([0, 6, 12]);
  });

  it('set_visibility hides a clip and the work area is shown in get_motion_doc', async () => {
    const { session, run } = await three();
    await run('set_visibility', { clip_id: 'id1', hidden: true });
    await run('set_work_area', { start: 0.5, end: 2 });
    expect(findClip(session.doc, 'id1')!.clip.hidden).toBe(true);
    const doc = (await run('get_motion_doc', {})) as Record<string, unknown>;
    expect(doc.workArea).toEqual({ start: 0.5, end: 2 });
  });
});
