import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';
import { MoveOutcome } from './move-element';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup(extra: Partial<MotionToolDeps> = {}) {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, props: { text: 'hi' } }, 'txt');
  const session: MotionSession = { doc: added.ok ? added.doc : newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), ...extra });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('move_to_frame', () => {
  it('lands the element in the other frame and takes it out of this one', async () => {
    const moveOut = vi.fn(async () => ({ outcome: MoveOutcome.Done as const, frameId: 'frame-b', clipId: 'txt', created: false, versions: { 'frame-b': 4 }, undo: [] }));
    const { run, session } = setup({ moveOut });

    const out = await run('move_to_frame', { clip_id: 'txt', frame_id: 'frame-b', x: 0.2, y: 0.8 });

    expect(out).toMatchObject({ ok: true, frame_id: 'frame-b', element_id: 'txt' });
    expect(moveOut).toHaveBeenCalledWith(expect.objectContaining({ clip: expect.objectContaining({ id: 'txt' }) }), { frameId: 'frame-b', at: { x: 0.2, y: 0.8 } });
    expect(findClip(session.doc, 'txt')).toBeNull();
  });

  it('a refused landing keeps the element here', async () => {
    const moveOut = vi.fn(async () => ({ outcome: MoveOutcome.Conflict as const }));
    const { run, session } = setup({ moveOut });

    expect(await run('move_to_frame', { clip_id: 'txt', frame_id: 'frame-b' })).toMatchObject({ ok: false });
    expect(findClip(session.doc, 'txt')).not.toBeNull();
  });

  it('an unknown element is refused before anything is written', async () => {
    const moveOut = vi.fn();
    const { run } = setup({ moveOut });

    expect(await run('move_to_frame', { clip_id: 'nope' })).toMatchObject({ ok: false });
    expect(moveOut).not.toHaveBeenCalled();
  });
});
