import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { expressionValue } from '$lib/motion/expression/bake';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('add_liquid_glass', () => {
  it('drops a glass lens over everything, in px, gliding on a spring and fading in', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 6, props: { text: 'Make it move.' } });

    const out = await run('add_liquid_glass', {
      start: 1,
      duration: 4,
      diameter: 360,
      path: [
        { time: 0, x: 200, y: 540 },
        { time: 0.6, x: 900, y: 520 }
      ],
      refraction: 0.7,
      fade_in: 0.4
    });

    expect(out).toMatchObject({ ok: true, clip_id: expect.any(String) });
    const { clip, track } = findClip(session.doc, String(out.clip_id))!;
    expect(session.doc.tracks[0].id).toBe(track.id);
    expect(clip.props).toMatchObject({ diameter: 360 / 1080, refraction: 0.7, centerX: 200 / 1920 });
    expect(expressionValue(session.doc, clip.id, 'centerX', clip.from + clip.durationInFrames - 1)).toBeCloseTo(900 / 1920, 3);
    expect(clip.keyframes.presence?.[0]).toMatchObject({ frame: 0, value: 0 });
  });

  it('refuses a stop outside the clip', async () => {
    const { run } = setup();

    expect(await run('add_liquid_glass', { start: 0, duration: 2, path: [{ time: 3, x: 0, y: 0 }] })).toMatchObject({ ok: false, error: expect.stringContaining('time') });
  });
});
