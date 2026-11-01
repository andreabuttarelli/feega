import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, clipsOf, newMotionDoc } from '@feega/motion-core/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

async function withButton() {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  let n = 0;
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  await run('add_shape', { kind: 'rect', start: 0 });
  return { session, run, id: clipsOf(session.doc)[0].id };
}

describe('element states through the agent tools', () => {
  it('set_element_state stores a hover row with its curve', async () => {
    const { session, run, id } = await withButton();

    const out = await run('set_element_state', { clip_id: id, state: 'hover', overrides: { opacity: 0.7, fill: '#2255ff' }, transition: { easing: 'enter', durationMs: 250 } });

    expect(out).toMatchObject({ ok: true });
    expect(clipsOf(session.doc)[0].states).toEqual([{ state: 'hover', overrides: { opacity: 0.7, fill: '#2255ff' }, transition: { easing: 'enter', durationMs: 250 } }]);
  });

  it('remove_element_state drops the row', async () => {
    const { session, run, id } = await withButton();
    await run('set_element_state', { clip_id: id, state: 'pressed', overrides: { scale: 0.96 } });

    expect(await run('remove_element_state', { clip_id: id, state: 'pressed' })).toMatchObject({ ok: true });
    expect(clipsOf(session.doc)[0].states).toBeUndefined();
  });
});
