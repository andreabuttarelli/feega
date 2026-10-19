import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, clipsOf, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('combine_shapes outline_stroke', () => {
  it('a filled, stroked rectangle keeps its fill and gains the outlined stroke above', async () => {
    const { run, session } = setup();
    await run('add_shape', { kind: 'rect', start: 0, fills: [{ type: 'solid', color: '#0000ff' }], strokes: [{ paint: { type: 'solid', color: '#ff0000' }, width: 0.01 }] });
    const id = clipsOf(session.doc)[0].id;

    expect(await run('combine_shapes', { clip_ids: [id], op: 'outline_stroke' })).toMatchObject({ ok: true });
    expect(clipsOf(session.doc).map((c) => c.props.shape).sort()).toEqual(['path', 'rect']);
  });

  it('refuses a shape with no stroke', async () => {
    const { run, session } = setup();
    await run('add_shape', { kind: 'rect', start: 0 });

    expect(await run('combine_shapes', { clip_ids: [clipsOf(session.doc)[0].id], op: 'outline_stroke' })).toMatchObject({ ok: false });
  });
});
