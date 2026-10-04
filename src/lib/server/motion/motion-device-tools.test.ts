import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('device tools', () => {
  it('a laptop mockup opens its lid with a preset', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Device3D', start: 0, duration: 4, props: { device: 'laptop-pro' } });
    const id = session.doc.tracks.flatMap((t) => t.clips)[0].id;
    await run('apply_device_preset', { clip_id: id, preset: 'lid-open' });
    expect(findClip(session.doc, id)!.clip.keyframes.lid?.map((k) => k.value)).toEqual([0, 110]);
  });

  it('adds a row of three phones', async () => {
    const { session, run } = setup();
    const result = await run('add_device_row', { device: 'phone', start: 0, duration: 5 });
    expect(result).not.toHaveProperty('error');
    expect(session.doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Device3D')).toHaveLength(3);
  });
});
