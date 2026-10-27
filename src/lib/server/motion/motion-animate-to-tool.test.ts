import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('motion agent animate_to', () => {
  it('keys the current value and the target, with the target in the units of set_transform', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });

    const out = await run('animate_to', { clip_id: 'id1', to: { opacity: 0 }, start: 0.5, duration: 1 });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.keyframes.opacity.map((k) => [k.frame, k.value])).toEqual([
      [15, 1],
      [45, 0]
    ]);
  });

  it('says why a prop is refused', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });

    expect(await run('animate_to', { clip_id: 'id1', to: { nonsense: 1 } })).toMatchObject({ ok: false, error: expect.stringContaining('nonsense') });
  });
});
