import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import type { ZodType } from 'zod';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup(overrides: Partial<MotionToolDeps> = {}) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), ...overrides });
  const run = (name: string, input: unknown) => {
    const found = tools[name] as Tool & { execute: Exec; inputSchema: ZodType };
    return found.execute(found.inputSchema.parse(input), { toolCallId: 'c' });
  };
  return { run };
}

const TEXT = { text: 'abcd', x: 500, y: 300, width: 400, height: 100, size: 20, tracking: 0, leading: 1.5, align: 'left' };

describe('measure_text', () => {
  it('gives the rendered box of a text clip in px from the font the renderer loads', async () => {
    const fontAdvance = vi.fn(async () => (run: string) => run.length * 0.6);
    const { run } = setup({ fontAdvance });
    await run('add_clip', { component: 'Text', start: 0, duration: 2, props: TEXT });

    const out = await run('measure_text', { clip_id: 'id1' });

    expect(out).toMatchObject({ ok: true, approximate: false, box: { left: 300, top: 285, width: 48, height: 30 }, lines: ['abcd'] });
    expect(fontAdvance).toHaveBeenCalledWith(expect.stringContaining('dm-sans'));
  });

  it('wraps at the box width like the page does', async () => {
    const { run } = setup({ fontAdvance: async () => (run: string) => run.length * 0.5 });
    await run('add_clip', { component: 'Text', start: 0, duration: 2, props: { ...TEXT, text: 'aaaa bbbb cccc', width: 100 } });

    const out = await run('measure_text', { clip_id: 'id1' });

    expect(out.lines).toEqual(['aaaa bbbb', 'cccc']);
  });

  it('without the font it estimates and says so', async () => {
    const { run } = setup({ fontAdvance: async () => null });
    await run('add_clip', { component: 'Text', start: 0, duration: 2, props: TEXT });

    expect(await run('measure_text', { clip_id: 'id1' })).toMatchObject({ ok: true, approximate: true });
  });

  it('refuses a clip that is not text', async () => {
    const { run } = setup();
    await run('add_shape', { kind: 'rect', start: 0, duration: 2 });

    expect((await run('measure_text', { clip_id: 'id1' })).ok).toBe(false);
  });
});
