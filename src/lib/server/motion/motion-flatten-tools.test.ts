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
