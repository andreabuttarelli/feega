import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { expressionValue } from '$lib/motion/expression/bake';
import { BLOB_NUMBER_KEYS, BLOB_TINT } from '$lib/motion/blob/model';
import { BLOB_INPUT } from '$lib/motion/blob/inputs';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('add_liquid_blob', () => {
  it('drops a 3D liquid blob over everything, in px, gliding on a spring, split into droplets', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 6, props: { text: 'Make it move.' } });

    const out = await run('add_liquid_blob', {
      start: 1,
      duration: 5,
      diameter: 300,
      path: [
        { time: 0, x: 200, y: 540 },
        { time: 1, x: 960, y: 540 }
      ],
      drops: 2,
      split: 216,
      ior: 1.33,
      dispersion: 0.1,
      tint: '#aaccff',
      fade_in: 0.3
    });

    expect(out).toMatchObject({ ok: true, clip_id: expect.any(String) });
    const { clip, track } = findClip(session.doc, String(out.clip_id))!;
    expect(clip.component).toBe('LiquidBlob');
    expect(session.doc.tracks[0].id).toBe(track.id);
    expect(clip.props).toMatchObject({ diameter: 300 / 1080, split: 216 / 1080, drops: 2, ior: 1.33, dispersion: 0.1, tint: '#aaccff' });
    expect(expressionValue(session.doc, clip.id, 'centerX', clip.from + clip.durationInFrames - 1)).toBeCloseTo(0.5, 3);
    expect(clip.keyframes.presence?.[0]).toMatchObject({ frame: 0, value: 0 });
  });

  it('refuses a stop outside the clip', async () => {
    const { run } = setup();

    expect(await run('add_liquid_blob', { start: 0, duration: 2, path: [{ time: 3, x: 0, y: 0 }] })).toMatchObject({ ok: false, error: expect.stringContaining('time') });
  });

  it('takes every blob setting the editor shows, except presence which fade_in/fade_out drive', () => {
    const covered = new Set<string>(Object.values(BLOB_INPUT));

    expect([...BLOB_NUMBER_KEYS, BLOB_TINT.key].filter((key) => !covered.has(key))).toEqual(['presence']);
  });
});
