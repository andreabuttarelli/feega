import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('set_canvas layout guides', () => {
  it('writes columns on the frame', async () => {
    const { run, session } = setup();

    expect(await run('set_canvas', { layout_guides: [{ kind: 'columns', count: 12, gutter: 24, margin: 64 }] })).toMatchObject({ ok: true });
    expect(session.doc.layoutGuides).toEqual([{ kind: 'columns', count: 12, gutter: 24, margin: 64, size: 8 }]);
  });

  it('an empty list removes them', async () => {
    const { run, session } = setup();

    await run('set_canvas', { layout_guides: [{ kind: 'grid', size: 8 }] });
    await run('set_canvas', { layout_guides: [] });

    expect(session.doc.layoutGuides).toBeUndefined();
  });
});
