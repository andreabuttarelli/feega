import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('arrange_space scale', () => {
  it('scales a text layer like the scale tool: box and type size together, from its top-left corner', async () => {
    const { run, session } = setup();
    await run('add_clip', { component: 'Text', start: 0, duration: 2, props: { text: 'hi', x: 960, y: 540, width: 384, height: 108, size: 54 } });
    const id = session.doc.tracks[0].clips[0].id;

    expect(await run('arrange_space', { clip_ids: [id], op: 'scale', factor: 2 })).toMatchObject({ ok: true });
    expect(findClip(session.doc, id)!.clip.props).toMatchObject({ width: 0.4, height: 0.2, size: 0.1, x: 0.6, y: 0.55 });
  });

  it('needs a factor', async () => {
    const { run, session } = setup();
    await run('add_clip', { component: 'Text', start: 0, duration: 2, props: { text: 'hi' } });

    expect(await run('arrange_space', { clip_ids: [session.doc.tracks[0].clips[0].id], op: 'scale' })).toMatchObject({ ok: false });
  });
});
