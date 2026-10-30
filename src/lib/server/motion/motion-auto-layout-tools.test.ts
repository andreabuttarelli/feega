import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { Direction, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('a stack child through the agent', () => {
  it('refuses x/y: the stack places it, reorder or make it absolute', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });
    await run('wrap_in_stack', { clip_ids: ['id1', 'id2'] });

    const moved = await run('set_props', { clip_id: 'id1', props: { x: 0.2 } });
    expect(moved.ok).toBe(false);
    expect(String(moved.error)).toMatch(/reorder_stack.*absolute/);

    await run('set_layout_item', { clip_id: 'id1', absolute: true });
    expect((await run('set_props', { clip_id: 'id1', props: { x: 0.2 } })).ok).toBe(true);
  });

  it('sizes a child by fill weight and percent', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });
    await run('wrap_in_stack', { clip_ids: ['id1'] });
    await run('set_layout_item', { clip_id: 'id1', width: Sizing.Fill, widthGrow: 2, height: Sizing.Percent, heightPercent: 50, alignSelf: 'end' });
    expect(findClip(session.doc, 'id1')!.clip.layoutItem).toMatchObject({ widthGrow: 2, heightPercent: 50, alignSelf: 'end' });
  });
});

describe('motion agent auto layout tools', () => {
  it('wraps clips, edits the layout without resetting what it does not name, sizes and reorders a child', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });
    await run('add_clip', { component: 'Kicker', start: 0, duration: 4 });

    const wrapped = await run('wrap_in_stack', { clip_ids: ['id1', 'id2'] });
    expect(wrapped.ok).toBe(true);
    const container = String(wrapped.container_id);
    expect(findClip(session.doc, 'id2')!.clip.parent).toBe(container);

    await run('set_stack', { clip_id: container, direction: Direction.Vertical });
    await run('set_stack', { clip_id: container, gap: 24 });
    expect(findClip(session.doc, container)!.clip.autoLayout).toMatchObject({ direction: Direction.Vertical, gap: 24 });

    await run('set_layout_item', { clip_id: 'id1', width: Sizing.Fill });
    expect(findClip(session.doc, 'id1')!.clip.layoutItem).toMatchObject({ width: Sizing.Fill });

    const order = findClip(session.doc, container)!.clip.autoLayout!.order;
    await run('reorder_stack', { container_id: container, clip_id: order[1], index: 0 });
    expect(findClip(session.doc, container)!.clip.autoLayout!.order).toEqual([order[1], order[0]]);

    await run('leave_stack', { clip_id: 'id1' });
    expect(findClip(session.doc, 'id1')!.clip.parent).toBeNull();
  });

  it('sets how the lines spread, the stacking and whether strokes count', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });
    const container = String((await run('wrap_in_stack', { clip_ids: ['id1'] })).container_id);

    await run('set_stack', { clip_id: container, wrap: true, alignContent: 'space-between', firstOnTop: true, strokesIncluded: false });

    expect(findClip(session.doc, container)!.clip.autoLayout).toMatchObject({ alignContent: 'space-between', firstOnTop: true, strokesIncluded: false });
  });

  it('removes a stack, keeping its children', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });
    await run('add_clip', { component: 'Kicker', start: 0, duration: 4 });
    const stack = String((await run('wrap_in_stack', { clip_ids: ['id1', 'id2'] })).container_id);

    expect((await run('remove_stack', { clip_id: stack })).ok).toBe(true);

    expect(findClip(session.doc, stack)).toBeNull();
    expect(findClip(session.doc, 'id2')!.clip.parent ?? null).toBeNull();
  });

  it('keeps fill outside a container and refuses auto layout on a clip without a box', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });
    await run('add_null', { start: 0 });
    expect((await run('set_layout_item', { clip_id: 'id1', width: Sizing.Fill })).ok).toBe(true);
    expect((await run('wrap_in_stack', { clip_id: 'id2' })).ok).toBe(false);
  });

  it('still answers to the auto layout names for one release, marked deprecated', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 4 });
    const container = String((await run('add_auto_layout', { clip_ids: ['id1'] })).container_id);
    await run('set_auto_layout', { clip_id: container, gap: 12 });

    expect(findClip(session.doc, container)!.clip.autoLayout).toMatchObject({ gap: 12 });
  });
});
