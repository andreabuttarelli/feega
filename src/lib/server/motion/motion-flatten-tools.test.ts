import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, clipsOf, newMotionDoc } from '@feega/motion-core/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('combine_shapes flatten', () => {
  it('turns one rectangle into a path', async () => {
    const { run, session } = setup();
    await run('add_shape', { kind: 'rect', start: 0 });
    const id = clipsOf(session.doc)[0].id;

    expect(await run('combine_shapes', { clip_ids: [id], op: 'flatten' })).toMatchObject({ ok: true });
    expect(clipsOf(session.doc)[0].props.shape).toBe('path');
  });

  it('a boolean still needs two shapes', async () => {
    const { run, session } = setup();
    await run('add_shape', { kind: 'rect', start: 0 });

    expect(await run('combine_shapes', { clip_ids: [clipsOf(session.doc)[0].id], op: 'union' })).toMatchObject({ ok: false });
  });
});

describe('combine_shapes live', () => {
  async function twoShapes() {
    const harness = setup();
    await harness.run('add_shape', { kind: 'rect', start: 0 });
    await harness.run('add_shape', { kind: 'ellipse', start: 0 });
    return { ...harness, ids: clipsOf(harness.session.doc).map((c) => c.id) };
  }

  it('groups the shapes and keeps them editable', async () => {
    const { run, session, ids } = await twoShapes();

    expect(await run('combine_shapes', { clip_ids: ids, op: 'union', live: true })).toMatchObject({ ok: true });
    const [group] = clipsOf(session.doc);
    expect(group.props.boolean).toBe('union');
    expect(Object.values(session.doc.comps)[0].tracks.flatMap((t) => t.clips)).toHaveLength(2);
  });

  it('flatten on the live group bakes it into one plain shape', async () => {
    const { run, session, ids } = await twoShapes();
    await run('combine_shapes', { clip_ids: ids, op: 'union', live: true });
    const [group] = clipsOf(session.doc);

    expect(await run('combine_shapes', { clip_ids: [group.id], op: 'flatten' })).toMatchObject({ ok: true });
    expect(clipsOf(session.doc)).toHaveLength(1);
    expect(clipsOf(session.doc)[0].props.shape).toBe('path');
    expect(Object.keys(session.doc.comps)).toHaveLength(0);
  });
});
