import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { transformAt } from '$lib/motion/parent';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

async function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  await run('add_clip', { component: 'Shape', start: 0, duration: 2, props: { shape: 'rect', x: 300, y: 540, width: 200, height: 200 } });
  await run('add_clip', { component: 'Shape', start: 0, duration: 2, props: { shape: 'rect', x: 900, y: 540, width: 200, height: 200 } });
  const ids = session.doc.tracks.flatMap((t) => t.clips.map((c) => c.id));
  return { session, run, ids };
}

describe('arrange_space on a whole selection', () => {
  it('rotate_group turns every clip by the same angle', async () => {
    const { run, session, ids } = await setup();

    expect(await run('arrange_space', { clip_ids: ids, op: 'rotate_group', degrees: 90 })).toMatchObject({ ok: true });
    for (const id of ids) {
      expect(transformAt(findClip(session.doc, id)!.clip, 'rotateZ', 0)).toBeCloseTo(90, 6);
    }
  });

  it('scale_group multiplies every clip scale by the factor', async () => {
    const { run, session, ids } = await setup();

    expect(await run('arrange_space', { clip_ids: ids, op: 'scale_group', factor: 2 })).toMatchObject({ ok: true });
    for (const id of ids) {
      expect(transformAt(findClip(session.doc, id)!.clip, 'scaleX', 0)).toBeCloseTo(2, 6);
    }
  });

  it('scale_group needs a factor and rotate_group needs degrees', async () => {
    const { run, ids } = await setup();

    expect(await run('arrange_space', { clip_ids: ids, op: 'scale_group' })).toMatchObject({ ok: false });
    expect(await run('arrange_space', { clip_ids: ids, op: 'rotate_group' })).toMatchObject({ ok: false });
  });
});
