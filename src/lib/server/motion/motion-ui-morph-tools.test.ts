import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { styleProblems } from '$lib/motion/style';
import { MotionStyle } from '$lib/motion/style-model';
import { REEL_COMPONENT } from '$lib/motion/ui-morph/piece';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: { ...newMotionDoc(MotionFormat.Square), fps: 60 }, baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(async () => null) });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('ui_morph_reel', () => {
  it('builds a looping reel that spans the video, in the ui-morph style, and passes the loop-seam gate', async () => {
    const { session, run } = setup();
    const added = await run('ui_morph_reel', { bpm: 120, accent: '#ff4f00' });

    expect(added.ok).toBe(true);
    expect(session.doc.durationInFrames).toBe(1680);
    expect(session.doc.style).toBe(MotionStyle.UiMorph);
    expect(findClip(session.doc, 'id1')?.clip.props).toMatchObject({ name: REEL_COMPONENT, accent: '#ff4f00', bpm: 120 });
    expect(styleProblems(session.doc)).toEqual([]);
  });

  it('the loop-seam gate names a reel that no longer spans the video', async () => {
    const { session, run } = setup();
    await run('ui_morph_reel', { states: ['button', 'loader', 'check'] });
    session.doc = { ...session.doc, durationInFrames: session.doc.durationInFrames + 30 };

    expect(styleProblems(session.doc).map((p) => p.effect)).toContain('loop-seam');
  });

  it('the too-dense gate names a reel that changes on every beat: the state needs a hold to be read', async () => {
    const { session, run } = setup();
    await run('ui_morph_reel', { beats_per_change: 1 });

    expect(styleProblems(session.doc).map((p) => p.effect)).toContain('too-dense');
  });

  it('refuses a state it does not know', async () => {
    const { run } = setup();

    expect((await run('ui_morph_reel', { states: ['button', 'carousel'] })).ok).toBe(false);
  });
});
