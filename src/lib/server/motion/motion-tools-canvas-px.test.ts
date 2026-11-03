import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import type { ZodType } from 'zod';
import { MotionFormat, findClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const LEGACY_SCALE = 0.5;

function setup(scale?: number, overrides: Partial<MotionToolDeps> = {}) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Vertical), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const deps: MotionToolDeps = {
    session,
    assets: [],
    newId: () => `id${++n}`,
    voiceover: vi.fn(async () => ({ ok: false as const, error: 'off' })),
    frames: vi.fn(async () => null),
    check: vi.fn(async () => null),
    ...(scale === undefined ? {} : { scale }),
    ...overrides
  };
  const tools = createMotionTools(deps);
  let call = 0;
  const run = (name: string, input: unknown) => {
    const found = tools[name] as Tool & { execute: Exec; inputSchema: ZodType };
    return found.execute(found.inputSchema.parse(input), { toolCallId: `call-${++call}` });
  };
  return { session, run };
}

type Summary = { width: number; height: number; userGuides: { at: number }[]; tracks: { clips: { id: string; box: { left: number; top: number; width: number; height: number } | null; transform: Record<string, number>; autoLayout: { gap: number; padding: { top: number } } | null }[] }[] };

const summary = async (run: ReturnType<typeof setup>['run']) => (await run('get_motion_doc', {})) as unknown as Summary;

const clipOf = (s: Summary, id: string) => s.tracks.flatMap((t) => t.clips).find((c) => c.id === id)!;

describe('the motion tools speak canvas px on a frame drawn at two doc px per canvas px', () => {
  it('get_motion_doc reports the frame as big as it is on the canvas', async () => {
    const { run } = setup(LEGACY_SCALE);

    const read = await summary(run);

    expect([read.width, read.height]).toEqual([540, 960]);
  });

  it('a box placed in canvas px lands at the same share of the frame', async () => {
    const { session, run } = setup(LEGACY_SCALE);

    const added = await run('add_shape', { kind: 'rect', start: 0, props: { left: 0, top: 0, width: 270, height: 480 } });
    const id = String(added.clip_id);

    expect(findClip(session.doc, id)?.clip.props).toMatchObject({ width: 0.5, height: 0.5, x: 0.25, y: 0.25 });
    expect(clipOf(await summary(run), id).box).toEqual({ left: 0, top: 0, width: 270, height: 480 });
  });

  it('a stroke in canvas px is that many canvas px of the short side', async () => {
    const { session, run } = setup(LEGACY_SCALE);

    const added = await run('add_shape', { kind: 'rect', start: 0, strokes: [{ paint: { type: 'solid', color: '#ffffff' }, width_px: 4 }] });
    const strokes = findClip(session.doc, String(added.clip_id))?.clip.props.strokes as { width: number }[];

    expect(strokes[0].width * 540).toBeCloseTo(4);
  });

  it('a pixel value of the transform is stored in doc px and read back in canvas px', async () => {
    const { session, run } = setup(LEGACY_SCALE);
    const id = String((await run('add_shape', { kind: 'rect', start: 0 })).clip_id);

    await run('set_transform', { clip_id: id, transform: { blur: 4 } });

    expect(findClip(session.doc, id)?.clip.transform.blur).toBe(8);
    expect(clipOf(await summary(run), id).transform.blur).toBe(4);
  });

  it('arrange_space moves by canvas px', async () => {
    const { session, run } = setup(LEGACY_SCALE);
    const id = String((await run('add_shape', { kind: 'rect', start: 0, props: { left: 0, top: 0, width: 100, height: 100 } })).clip_id);
    const before = Number(findClip(session.doc, id)?.clip.transform.x ?? 0);

    await run('arrange_space', { clip_ids: [id], op: 'move', dx: 54 });

    expect(Number(findClip(session.doc, id)?.clip.transform.x) - before).toBeCloseTo(54 / 540);
  });

  it('a stack gap and padding are canvas px', async () => {
    const { session, run } = setup(LEGACY_SCALE);
    const a = String((await run('add_shape', { kind: 'rect', start: 0, props: { left: 0, top: 0, width: 50, height: 50 } })).clip_id);
    const b = String((await run('add_shape', { kind: 'rect', start: 0, props: { left: 100, top: 0, width: 50, height: 50 } })).clip_id);
    const stack = String((await run('wrap_in_stack', { clip_ids: [a, b] })).container_id);

    await run('set_stack', { clip_id: stack, gap: 8, padding: { top: 12, right: 0, bottom: 0, left: 0 } });

    expect(findClip(session.doc, stack)?.clip.autoLayout).toMatchObject({ gap: 16, padding: { top: 24 } });
    expect(clipOf(await summary(run), stack).autoLayout).toMatchObject({ gap: 8, padding: { top: 12 } });
  });

  it('a layout item min width is canvas px', async () => {
    const { session, run } = setup(LEGACY_SCALE);
    const id = String((await run('add_shape', { kind: 'rect', start: 0 })).clip_id);

    await run('set_layout_item', { clip_id: id, minWidth: 40 });

    expect(findClip(session.doc, id)?.clip.layoutItem?.minWidth).toBe(80);
  });

  it('set_canvas takes the new size in canvas px and keeps the density', async () => {
    const { session, run } = setup(LEGACY_SCALE);

    await run('set_canvas', { width: 600, height: 400 });

    expect([session.doc.width, session.doc.height]).toEqual([1200, 800]);
  });

  it('a guide sits at canvas px from the edge', async () => {
    const { session, run } = setup(LEGACY_SCALE);

    await run('add_guide', { axis: 'vertical', at: 100 });

    expect(session.doc.userGuides?.[0].at).toBe(200);
    expect((await summary(run)).userGuides[0].at).toBe(100);
  });

  it('export_image scale 1 is one image px per canvas px', async () => {
    const exportStill = vi.fn(async () => ({ ok: true as const, asset_id: 'a', url: 'u', width: 1, height: 1 }));
    const { run } = setup(LEGACY_SCALE, { exportStill });

    await run('export_image', {});

    expect(exportStill).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scale: LEGACY_SCALE }));
  });

  it('without a node box the tools keep speaking doc px', async () => {
    const { session, run } = setup();
    const id = String((await run('add_shape', { kind: 'rect', start: 0 })).clip_id);

    await run('set_transform', { clip_id: id, transform: { blur: 4 } });

    expect((await summary(run)).width).toBe(1080);
    expect(findClip(session.doc, id)?.clip.transform.blur).toBe(4);
  });
});
