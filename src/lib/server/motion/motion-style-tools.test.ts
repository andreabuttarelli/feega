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
  it('the doc shows Apple minimal until the user asks for another style, and set_style keeps it', async () => {
    const { session, run } = setup();

    expect((await run('get_motion_doc', {})).style).toBe(MotionStyle.AppleMinimal);
    expect((await run('set_style', { style: MotionStyle.AppleMinimal })).ok).toBe(true);
    expect(session.doc.style).toBe(MotionStyle.AppleMinimal);
  });

  it('view_frames names a forbidden effect in its quality list', async () => {
    const { run } = setup();
    await run('add_particles', { preset: 'sparks', start: 0, duration: 2 });
    const out = await run('view_frames', { times: [1] });

    expect(JSON.stringify(out.quality)).toContain('particle');
  });

  it('the prompt directs in Apple minimal by default: scene library, signed eases, the forbidden list', () => {
    const text = prompt();

    expect(text).toContain('Apple');
    expect(text).toContain('builtin:scene-');
    expect(text).toContain('cubic-bezier(0.22,1,0.36,1)');
    expect(text).toContain('particles');
    expect(text).not.toContain('push, wipe, zoom, whip');
  });
});
