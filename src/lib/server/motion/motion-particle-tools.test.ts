import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { PRESET_PROPS, ParticlePreset } from '$lib/motion/particles/presets';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('particle tools', () => {
  it('adds confetti from a preset, with the agent own overrides on top', async () => {
    const { session, run } = setup();
    const result = await run('add_particles', { preset: 'confetti', start: 1, duration: 3, props: { seed: 9, rate: 200 } });
    expect(result).not.toHaveProperty('error');
    const clip = session.doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Particles')!;
    expect(clip.props).toMatchObject({ seed: 9, rate: 200, spin: PRESET_PROPS[ParticlePreset.Confetti].props.spin });
    expect(clip.from).toBe(30);
  });

  it('switches an emitter to snow and animates its rate', async () => {
    const { session, run } = setup();
    await run('add_particles', { preset: 'sparks', start: 0, duration: 4 });
    await run('apply_particle_preset', { clip_id: 'id1', preset: 'snow' });
    const keyed = await run('set_keyframes', { clip_id: 'id1', prop: 'rate', keyframes: [{ time: 0, value: 0 }, { time: 2, value: 120 }] });
    expect(keyed).not.toHaveProperty('error');
    const clip = findClip(session.doc, 'id1')!.clip;
    expect(clip.props.wobble).toBe(PRESET_PROPS[ParticlePreset.Snow].props.wobble);
    expect(clip.keyframes.rate?.map((k) => k.value)).toEqual([0, 120]);
  });
});
