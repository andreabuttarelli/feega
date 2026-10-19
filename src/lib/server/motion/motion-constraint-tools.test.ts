import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, clipsOf, newMotionDoc } from '$lib/motion/doc';
import { pivotBox } from '$lib/motion/parent';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('constraints through set_layout_item', () => {
  it('a layer pinned right keeps its distance to the right edge when set_canvas resizes the frame', async () => {
    const { run, session } = setup();
    await run('add_shape', { kind: 'rect', start: 0 });
    const id = clipsOf(session.doc)[0].id;
    const before = pivotBox(clipsOf(session.doc)[0].props, session.doc);

    expect(await run('set_layout_item', { clip_id: id, constraints: { horizontal: 'right', vertical: 'top' } })).toMatchObject({ ok: true });
    await run('set_canvas', { width: 1440, height: 1080 });

    const after = pivotBox(clipsOf(session.doc)[0].props, session.doc);
    expect(1920 - (before.left + before.width)).toBeCloseTo(1440 - (after.left + after.width));
    expect(after.width).toBeCloseTo(before.width);
  });
});
