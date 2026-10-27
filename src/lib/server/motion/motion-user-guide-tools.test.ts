import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('add_guide and remove_guide', () => {
  it('adds a vertical guide', async () => {
    const { run, session } = setup();

    expect(await run('add_guide', { axis: 'vertical', at: 960 })).toMatchObject({ ok: true });
    expect(session.doc.userGuides).toEqual([{ axis: 'x', at: 960 }]);
  });

  it('adds a horizontal guide', async () => {
    const { run, session } = setup();

    await run('add_guide', { axis: 'horizontal', at: 540 });

    expect(session.doc.userGuides).toEqual([{ axis: 'y', at: 540 }]);
  });

  it('refuses a position outside the frame', async () => {
    const { run } = setup();

    expect(await run('add_guide', { axis: 'vertical', at: 99999 })).toMatchObject({ ok: false });
  });

  it('removes one guide', async () => {
    const { run, session } = setup();

    await run('add_guide', { axis: 'vertical', at: 100 });
    await run('add_guide', { axis: 'horizontal', at: 200 });
    await run('remove_guide', { axis: 'vertical', at: 100 });

    expect(session.doc.userGuides).toEqual([{ axis: 'y', at: 200 }]);
  });

  it('removes them all without a position', async () => {
    const { run, session } = setup();

    await run('add_guide', { axis: 'vertical', at: 100 });
    await run('remove_guide', {});

    expect(session.doc.userGuides).toBeUndefined();
  });

  it('shows the guides in the frame state', async () => {
    const { run } = setup();

    await run('add_guide', { axis: 'vertical', at: 100 });

    expect(JSON.stringify(await run('get_motion_doc', {}))).toContain('userGuides');
  });
});
