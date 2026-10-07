import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('motion agent blend tool', () => {
  it('set_blend_mode sets and resets a clip mode, shown in the doc; an unknown mode is refused by the schema', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 2 });

    expect((await run('set_blend_mode', { clip_id: 'id1', mode: 'screen' })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.blend).toBe('screen');
    expect(JSON.stringify(await run('get_motion_doc', {}))).toContain('"blend":"screen"');
    await run('set_blend_mode', { clip_id: 'id1', mode: 'normal' });
    expect(findClip(session.doc, 'id1')!.clip.blend).toBe('normal');
  });

  it('the prompt mentions blend modes', () => {
    expect(motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing })).toContain('set_blend_mode');
  });
});
