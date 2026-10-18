import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { MotionStyle } from '$lib/motion/style-model';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const frames = vi.fn(async (_id: string, times: number[]) => times.map((time) => ({ time, bytes: Buffer.from('x') })));
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames, check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

const prompt = (style?: MotionStyle) => motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available, style });

describe('the motion style', () => {
  it('the doc shows the launch film until the user asks for another style, and set_style changes it', async () => {
    const { session, run } = setup();

    expect((await run('get_motion_doc', {})).style).toBe(MotionStyle.LaunchFilm);
    expect((await run('set_style', { style: MotionStyle.AppleMinimal })).ok).toBe(true);
    expect(session.doc.style).toBe(MotionStyle.AppleMinimal);
  });

  it('view_frames names a forbidden effect in its quality list', async () => {
    const { run } = setup();
    await run('add_particles', { preset: 'sparks', start: 0, duration: 2 });
    const out = await run('view_frames', { times: [1] });

    expect(JSON.stringify(out.quality)).toContain('particle');
  });

  it('the prompt directs a launch film by default: launch scenes, the beat, a peak, the forbidden list', () => {
    const text = prompt();

    expect(text).toContain('Launch film');
    expect(text).toContain('builtin:launch-');
    expect(text).toContain('cut_to_beat');
    expect(text).toContain('peak');
    expect(text).toContain('enter (feega.out)');
    expect(text).toContain('particles');
    expect(text).not.toContain('mean more care, not more effects');
    expect(text).toContain('A real brand logo is always the original asset');
    expect(text).toContain('hard cut is the exception');
    expect(text).not.toContain('Logo3D extrudes an SVG logo (the brand logo by default)');
  });

  it('the Apple minimal prompt stays calm when the user asks for it', () => {
    const text = prompt(MotionStyle.AppleMinimal);

    expect(text).toContain('Apple minimal');
    expect(text).toContain('builtin:scene-');
  });
});

describe('the look measured from the references', () => {
  const SWISS = { typeScale: 0.8, bleed: true, columns: 3, smallText: 'dense', palette: ['#e30613', '#0a0a0a'], font: 'condensed', imagery: 'shapes' };

  it('set_reference_look stores the targets on the doc and get_motion_doc shows them', async () => {
    const { session, run } = setup();

    expect((await run('set_reference_look', SWISS)).ok).toBe(true);
    expect(session.doc.referenceLook?.typeScale).toBe(0.8);
    expect((await run('get_motion_doc', {})).referenceLook).toEqual(SWISS);
  });

  it('view_frames blocks a video that looked at references and never recorded their look', async () => {
    const { session, run } = setup();
    session.references = [{ mediaType: 'image/jpeg', data: 'cGlu' }];
    await run('add_clip', { component: 'Title', start: 0, duration: 2, props: { text: 'FORM' } });

    expect(JSON.stringify((await run('view_frames', { times: [1] })).blocking)).toContain('set_reference_look');
  });

  it('view_frames names the gross misses against the recorded look', async () => {
    const { run } = setup();
    await run('set_reference_look', SWISS);
    await run('add_clip', { component: 'Title', start: 0, duration: 2, props: { text: 'FORM' } });
    const out = await run('view_frames', { times: [1] });

    expect(JSON.stringify(out.blocking)).toContain('0.8 of the frame height');
    expect(JSON.stringify(out.blocking)).toContain('off the frame edge');
  });
});
