import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import type { z } from 'zod';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

enum Draws {
  Picture = 'picture',
  Nothing = 'nothing'
}

const CREATION_TOOLS: Record<string, Draws> = {
  add_clip: Draws.Picture,
  add_shape: Draws.Picture,
  add_particles: Draws.Picture,
  add_device_row: Draws.Picture,
  add_null: Draws.Nothing,
  generate_voiceover: Draws.Nothing
};

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  const keys = (name: string) => Object.keys((tools[name].inputSchema as z.ZodObject).shape);
  return { session, run, keys };
}

describe('the tools that create clips take the same placement', () => {
  it.each(Object.keys(CREATION_TOOLS))('%s takes track_id', (name) => {
    expect(setup().keys(name)).toContain('track_id');
  });

  it.each(Object.entries(CREATION_TOOLS).filter(([, draws]) => draws === Draws.Picture).map(([name]) => name))('%s takes effects', (name) => {
    expect(setup().keys(name)).toContain('effects');
  });

  it('a glow shape lands on the track it names, blurred, and says its clip id', async () => {
    const { session, run } = setup();
    expect((await run('add_track', { kind: 'visual', name: 'FX' })).ok).toBe(true);
    const fx = session.doc.tracks.find((t) => t.name === 'FX')!.id;

    const out = await run('add_shape', { kind: 'circle', start: 0, duration: 3, track_id: fx, effects: [{ kind: 'gaussian-blur', params: { radius: 80 } }] });

    expect(out).toMatchObject({ ok: true, clip_id: expect.any(String) });
    const placed = findClip(session.doc, String(out.clip_id))!;
    expect(placed.track.id).toBe(fx);
    expect(placed.clip.effects.map((e) => e.kind)).toEqual(['gaussian-blur']);
  });

  it('add_clip says the id of the clip it made', async () => {
    const { run } = setup();

    expect(await run('add_clip', { component: 'Title', start: 0, duration: 2, props: { text: 'Hi' } })).toMatchObject({ ok: true, clip_id: expect.any(String) });
  });

  it('a refused effect leaves no clip behind', async () => {
    const { session, run } = setup();

    const out = await run('add_shape', { kind: 'circle', start: 0, duration: 3, effects: [{ kind: 'gaussian-blur', params: { radius: 'huge' } }] });

    expect(out.ok).toBe(false);
    expect(session.doc.tracks.flatMap((t) => t.clips)).toEqual([]);
  });
});
