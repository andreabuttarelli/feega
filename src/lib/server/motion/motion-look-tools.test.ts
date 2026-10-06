import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { z } from 'zod';
import { ENV_PRESETS, EnvPreset } from '$lib/motion/look';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Square), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('look tools', () => {
  it('lights the scene, keyframes a light in seconds, and shows it in the doc', async () => {
    const { session, run } = setup();
    await run('set_look', { environment: { preset: 'sunset', intensity: 1.5 }, soft_shadows: true });
    await run('set_light', { id: 'key', kind: 'spot', color: '#ffeedd', intensity: 12, x: 2, y: 5, z: 3 });
    await run('set_light_keyframes', { id: 'key', prop: 'intensity', keyframes: [{ time: 0, value: 0 }, { time: 1, value: 12 }] });
    expect(session.doc.look?.environment).toMatchObject({ preset: 'sunset', intensity: 1.5 });
    expect(session.doc.look?.lights[0].keyframes.intensity?.map((k) => k.frame)).toEqual([0, 30]);
    const shown = (await run('get_motion_doc', {})) as { look: { lights: { keyframes: { intensity: { time: number }[] } }[] } };
    expect(shown.look.lights[0].keyframes.intensity.map((k) => k.time)).toEqual([0, 1]);
  });

  it('removes a light and turns the look off', async () => {
    const { session, run } = setup();
    await run('set_light', { id: 'rim', kind: 'point' });
    await run('remove_light', { id: 'rim' });
    expect(session.doc.look?.lights).toEqual([]);
    await run('set_look', { enabled: false });
    expect(session.doc.look).toBeNull();
  });
});

describe('set_look environment presets', () => {
  const schema = () => createMotionTools({ session: { doc: newMotionDoc(MotionFormat.Square), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 }, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() }).set_look.inputSchema as z.ZodType;

  it('the model sees every preset in the schema', () => {
    expect(JSON.stringify(z.toJSONSchema(schema(), { io: 'input' }))).toContain(JSON.stringify(ENV_PRESETS));
  });

  it('studio, the name a model reaches for first, is the neutral room', () => {
    expect(schema().parse({ environment: { preset: 'studio' } })).toMatchObject({ environment: { preset: EnvPreset.Room } });
  });
});
