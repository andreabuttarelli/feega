import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, formatOf, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('set_canvas with a custom size', () => {
  it('width and height make a custom frame of that size', async () => {
    const { run, session } = setup();

    expect(await run('set_canvas', { width: 1200, height: 900 })).toMatchObject({ ok: true });
    expect([session.doc.width, session.doc.height, formatOf(session.doc)]).toEqual([1200, 900, MotionFormat.Custom]);
  });

  it('format custom keeps the size and unlocks it', async () => {
    const { run, session } = setup();

    await run('set_canvas', { format: MotionFormat.Custom });

    expect([session.doc.width, session.doc.height, formatOf(session.doc)]).toEqual([1920, 1080, MotionFormat.Custom]);
  });

  it('refuses a size above 1080p', async () => {
    const { run, session } = setup();

    expect(await run('set_canvas', { width: 1900, height: 1900 })).toMatchObject({ ok: false });
    expect(session.doc.width).toBe(1920);
  });

  it('get_motion_doc reports the custom size', async () => {
    const { run } = setup();
    await run('set_canvas', { width: 1000, height: 1000 });

    expect(await run('get_motion_doc', {})).toMatchObject({ width: 1000, height: 1000 });
  });
});
