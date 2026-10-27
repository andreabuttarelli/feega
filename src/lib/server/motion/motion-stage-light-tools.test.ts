import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, clipsOf, newMotionDoc } from '@feega/motion-core/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('stage light tools', () => {
  it('refuses a light while the video has no camera', async () => {
    const { run } = setup();

    expect(await run('set_stage_light', { kind: 'point', start: 0 })).toMatchObject({ ok: false });
  });

  it('adds a light with the camera on, then edits it by clip id', async () => {
    const { session, run } = setup();
    await run('set_camera', { enabled: true });

    const added = await run('set_stage_light', { kind: 'spot', color: '#ff8800', cone_angle: 40, x: 100, start: 0, duration: 3 });
    const light = clipsOf(session.doc).find((c) => c.component === 'Light')!;
    await run('set_stage_light', { clip_id: added.clip_id, intensity: 2, depth: -300 });
    const edited = clipsOf(session.doc).find((c) => c.component === 'Light')!;

    expect(light.props).toMatchObject({ kind: 'spot', color: '#ff8800', coneAngle: 40 });
    expect(light.transform.x).toBeCloseTo(100 / 1920, 5);
    expect(edited.props.intensity).toBe(2);
    expect(edited.depth).toBe(-300);
  });

  it('opts a layer out of the lights with set_clip_depth', async () => {
    const { session, run } = setup();
    await run('set_camera', { enabled: true });
    const shape = await run('add_clip', { component: 'Shape', start: 0, duration: 2 });

    await run('set_clip_depth', { clip_id: shape.clip_id, accepts_lights: false });

    expect(clipsOf(session.doc).find((c) => c.component === 'Shape')?.acceptsLights).toBe(false);
  });
});
