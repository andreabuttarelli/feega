import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { Space } from '$lib/motion/camera';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  const schema = (name: string) => (tools[name] as Tool & { inputSchema: { safeParse: (x: unknown) => { success: boolean } } }).inputSchema;
  return { session, run, schema };
}

describe('motion agent camera tools', () => {
  it('set_camera turns the camera on with base values and off again', async () => {
    const { session, run } = setup();
    const on = await run('set_camera', { values: { fov: 35, focusDistance: 400 }, dof: true });

    expect(on.ok).toBe(true);
    expect(session.doc.camera).toEqual({ base: { fov: 35, focusDistance: 400 }, dof: true, keyframes: {}, expressions: {} });

    await run('set_camera', { enabled: false });
    expect(session.doc.camera).toBeNull();
  });

  it('a value out of range comes back as an error, nothing changes', async () => {
    const { session, run } = setup();
    const out = await run('set_camera', { values: { fov: 500 } });

    expect(out.ok).toBe(false);
    expect(session.doc.camera).toBeNull();
  });

  it('set_camera_keyframes takes seconds from the start of the video', async () => {
    const { session, run, schema } = setup();
    await run('set_camera_keyframes', { prop: 'z', keyframes: [{ time: 0, value: 0 }, { time: 2, value: 600, ease: [0.3, 0, 0.2, 1] }] });

    expect(session.doc.camera!.keyframes.z!.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [60, 600]
    ]);
    expect(schema('set_camera_keyframes').safeParse({ prop: 'orbit', keyframes: [{ time: 0, value: 1 }] }).success).toBe(false);
  });

  it('apply_camera_preset builds the move; a rack focus names its clips', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 5 });
    await run('add_clip', { component: 'Image', start: 0, duration: 5 });
    await run('set_clip_depth', { clip_id: 'id2', depth: 900 });

    const rack = await run('apply_camera_preset', { preset: 'rack-focus', start: 1, duration: 2, from_clip: 'id1', to_clip: 'id2' });
    const missing = await run('apply_camera_preset', { preset: 'rack-focus', start: 1, duration: 2, from_clip: 'id1' });

    expect(rack.ok).toBe(true);
    expect(session.doc.camera!.keyframes.focusDistance!.map((k) => k.value)).toEqual([0, 900]);
    expect(String(missing.error)).toContain('to');
  });

  it('set_clip_depth moves a clip in depth or keeps it on the screen', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Caption', start: 0 });
    await run('set_clip_depth', { clip_id: 'id1', space: 'screen' });

    expect(findClip(session.doc, 'id1')!.clip).toMatchObject({ depth: 0, space: Space.Screen });
  });

  it('the doc the agent reads shows the camera in seconds and each clip depth', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    await run('apply_camera_preset', { preset: 'dolly-in', start: 0, duration: 1 });
    const doc = (await run('get_motion_doc', {})) as { camera: { keyframes: Record<string, { time: number }[]> }; tracks: { clips: { depth: number; space: string }[] }[] };

    expect(doc.camera.keyframes.z.map((k) => k.time)).toEqual([0, 1]);
    expect(doc.tracks[0].clips[0]).toMatchObject({ depth: 0, space: 'world' });
  });

  it('the prompt teaches the camera', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });

    for (const name of ['set_camera', 'set_camera_keyframes', 'apply_camera_preset', 'set_clip_depth']) {
      expect(prompt).toContain(name);
    }
  });
});
