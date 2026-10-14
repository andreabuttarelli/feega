import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';
import type { TemplateLibrary } from './templates';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup(templates?: TemplateLibrary) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), templates });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  const clips = () => session.doc.tracks.flatMap((t) => t.clips);
  return { session, run, clips };
}

describe('the editor clip buttons an agent can press too', () => {
  it('split_clip cuts a clip in two at the frame, like Split', async () => {
    const { run, clips } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 2, props: { text: 'Hello' } });
    const [clip] = clips();

    expect((await run('split_clip', { clip_ids: [clip!.id], frame: 30 })).ok).toBe(true);
    expect(clips().map((c) => [c.from, c.durationInFrames])).toEqual([
      [0, 30],
      [30, clip!.durationInFrames - 30]
    ]);
  });

  it('duplicate_clip adds a copy after the original and names it', async () => {
    const { run, clips } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 1, props: { text: 'Hello' } });

    const done = await run('duplicate_clip', { clip_ids: [clips()[0]!.id] });

    expect(clips()).toHaveLength(2);
    expect(done.clip_ids).toEqual([clips()[1]!.id]);
  });

  it('delete_template removes a team template through the same library the editor uses', async () => {
    const remove = vi.fn(async () => true);
    const { run } = setup({ list: vi.fn(), own: vi.fn(), save: vi.fn(), remove } as unknown as TemplateLibrary);

    expect(await run('delete_template', { template_id: 't1' })).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith('t1');
  });
});
