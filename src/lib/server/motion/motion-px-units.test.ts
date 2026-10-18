import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import type { ZodType } from 'zod';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => {
    const found = tools[name] as Tool & { execute: Exec; inputSchema: ZodType };
    return found.execute(found.inputSchema.parse(input), { toolCallId: 'c' });
  };
  return { session, run };
}

const WHITE = { type: 'solid', color: '#ffffff' };

type Read = { tracks: { clips: { id: string; box: unknown; radius: unknown; strokes_px: unknown }[] }[] };

const clipRead = async (run: ReturnType<typeof setup>['run'], id: string) =>
  ((await run('get_motion_doc', {})) as unknown as Read).tracks.flatMap((t) => t.clips).find((c) => c.id === id)!;

describe('motion tools in px', () => {
  it('a shape placed by its top-left corner, with corner radius and stroke in px, is stored as the renderer reads it', async () => {
    const { session, run } = setup();
    const { width, height } = session.doc;
    const short = Math.min(width, height);

    await run('add_shape', { kind: 'rect', start: 0, duration: 2, props: { left: 100, top: 50, width: 200, height: 100, radius: 20 }, strokes: [{ paint: WHITE, width_px: 4, align: 'inside' }] });

    const props = findClip(session.doc, 'id1')!.clip.props as Record<string, unknown> & { strokes: { width: number }[] };
    expect(props.x).toBeCloseTo(200 / width);
    expect(props.y).toBeCloseTo(100 / height);
    expect(props.width).toBeCloseTo(200 / width);
    expect(props.roundness).toBeCloseTo(0.2);
    expect(props.strokes[0].width).toBeCloseTo(4 / short);
    expect(props).not.toHaveProperty('left');
  });

  it('reads give back the px top-left box, the corner radius and the stroke widths next to the stored values', async () => {
    const { run } = setup();
    await run('add_shape', { kind: 'rect', start: 0, duration: 2, props: { left: 100, top: 50, width: 200, height: 100, radius: 20 }, strokes: [{ paint: WHITE, width_px: 4 }] });

    const clip = await clipRead(run, 'id1');

    expect(clip.box).toEqual({ left: 100, top: 50, width: 200, height: 100 });
    expect(clip.radius).toBe(20);
    expect(clip.strokes_px).toEqual([4]);
  });

  it('set_props moves a clip by its top-left corner and keeps its size', async () => {
    const { run } = setup();
    await run('add_shape', { kind: 'rect', start: 0, duration: 2, props: { left: 100, top: 50, width: 200, height: 100 } });

    await run('set_props', { clip_id: 'id1', props: { left: 300, top: 0 } });

    expect((await clipRead(run, 'id1')).box).toEqual({ left: 300, top: 0, width: 200, height: 100 });
  });

  it('the older centre x/y and stroke widths as fractions keep working', async () => {
    const { session, run } = setup();
    await run('add_shape', { kind: 'rect', start: 0, duration: 2, props: { x: 200, y: 100, width: 200, height: 100, roundness: 0.2 }, strokes: [{ paint: WHITE, width: 0.0037 }] });

    const props = findClip(session.doc, 'id1')!.clip.props as Record<string, unknown> & { strokes: { width: number }[] };
    expect(props.x).toBeCloseTo(200 / session.doc.width);
    expect(props.roundness).toBeCloseTo(0.2);
    expect(props.strokes[0].width).toBeCloseTo(0.0037);
  });
});
