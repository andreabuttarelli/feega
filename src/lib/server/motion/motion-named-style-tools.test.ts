import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('style tools', () => {
  it('a style edited by the agent restyles the clips that use it', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    const id = session.doc.tracks[0].clips[0].id;

    expect((await run('named_style', { action: 'define', name: 'Headline', style: { kind: 'text', size: 0.2 } })).ok).toBe(true);
    expect((await run('named_style', { action: 'apply', clip_ids: [id], name: 'Headline' })).ok).toBe(true);
    await run('named_style', { action: 'define', name: 'Headline', style: { kind: 'text', size: 0.25 } });

    expect(session.doc.tracks[0].clips[0].props.size).toBe(0.25);
    expect(((await run('named_style', { action: 'list' })).styles as { clips: string[] }[])[0].clips).toEqual([id]);
  });
});
