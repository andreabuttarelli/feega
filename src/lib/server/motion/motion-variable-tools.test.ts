import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('variable tools', () => {
  it('a mode switch by the agent recolours a bound clip, and set_props refuses the bound prop', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    const id = session.doc.tracks[0].clips[0].id;

    const defined = await run('variable', { action: 'define', collection: 'Theme', name: 'ink', type: 'colour', values: { Light: '#111111', Dark: '#eeeeee' }, modes: ['Light', 'Dark'] });
    expect(defined.ok).toBe(true);
    expect((await run('variable', { action: 'bind', collection: 'Theme', name: 'ink', clip_id: id, target: 'color' })).ok).toBe(true);
    expect(session.doc.tracks[0].clips[0].props.color).toBe('#111111');

    await run('variable', { action: 'mode', collection: 'Theme', mode: 'Dark' });
    expect(session.doc.tracks[0].clips[0].props.color).toBe('#eeeeee');

    expect((await run('set_props', { clip_id: id, props: { color: '#ff0000' } })).ok).toBe(false);
    expect(((await run('variable', { action: 'list' })).variables as Record<string, unknown>).Theme).toBeDefined();
  });
});
