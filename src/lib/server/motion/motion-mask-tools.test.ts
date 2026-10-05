import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Square), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const assets = [{ id: 'pic', kind: 'image' as never, label: 'pic', previewUrl: '', url: null }];
  const tools = createMotionTools({ session, assets, newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('motion agent mask tools', () => {
  it('set_mask stores the mask and the doc summary shows it', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Image', start: 0, props: { assetId: 'pic' } });
    const out = await run('set_mask', { clip_id: 'id1', mask: { kind: 'ellipse', width: 324, feather: 20 } });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.mask).toMatchObject({ kind: 'ellipse', width: 0.3, feather: 20 });
    expect(JSON.stringify(out.doc)).toContain('"mask":{"kind":"ellipse"');
  });

  it('a mask asset must be one of the project assets', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Image', start: 0, props: { assetId: 'pic' } });

    expect((await run('set_mask', { clip_id: 'id1', mask: { kind: 'luma', assetId: 'nope' } })).ok).toBe(false);
    expect((await run('set_mask', { clip_id: 'id1', mask: { kind: 'luma', assetId: 'pic' } })).ok).toBe(true);
  });

  it('mask props animate through set_keyframes', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Image', start: 0, props: { assetId: 'pic' } });
    await run('set_mask', { clip_id: 'id1', mask: { kind: 'ellipse' } });
    const out = await run('set_keyframes', { clip_id: 'id1', prop: 'maskWidth', keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1.5 }] });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.keyframes.maskWidth).toHaveLength(2);
  });

  it('remove_mask drops the mask and its keyframes', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Image', start: 0, props: { assetId: 'pic' } });
    await run('set_mask', { clip_id: 'id1', mask: { kind: 'rect' } });
    await run('set_keyframes', { clip_id: 'id1', prop: 'maskX', keyframes: [{ time: 0, value: 0.2 }] });
    const out = await run('remove_mask', { clip_id: 'id1' });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.mask).toBeNull();
    expect(findClip(session.doc, 'id1')!.clip.keyframes).toEqual({});
  });

  it('set_track_matte uses the clip on the track above, and says so when there is none', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Image', start: 0, props: { assetId: 'pic' } });

    const none = await run('set_track_matte', { clip_id: 'id1', matte: 'alpha' });
    expect(none.ok).toBe(false);
    expect(String(none.error)).toMatch(/above/);

    await run('add_track', { kind: 'visual' });
    await run('add_clip', { component: 'Title', start: 0, track_id: 'id2', props: { text: 'GO' } });
    const out = await run('set_track_matte', { clip_id: 'id1', matte: 'alpha' });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.matte).toBe('alpha');
  });

  it('set_track_matte takes any clip above, a video too, and the inverted mattes', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Image', start: 0, props: { assetId: 'pic' } });
    await run('add_track', { kind: 'visual' });
    await run('add_clip', { component: 'Video', start: 0, track_id: 'id2', props: { assetId: 'pic' } });

    for (const matte of ['alpha-inverted', 'luma', 'luma-inverted']) {
      const out = await run('set_track_matte', { clip_id: 'id1', matte });
      expect(out.ok).toBe(true);
      expect(findClip(session.doc, 'id1')!.clip.matte).toBe(matte);
    }
  });

  it('set_mask_stack folds more masks into the first one, each by its mode', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Image', start: 0, props: { assetId: 'pic' } });

    const lonely = await run('set_mask_stack', { clip_id: 'id1', masks: [{ kind: 'rect', mode: 'subtract' }] });
    expect(lonely.ok).toBe(false);

    await run('set_mask', { clip_id: 'id1', mask: { kind: 'ellipse', mode: 'add' } });
    expect((await run('set_mask_stack', { clip_id: 'id1', masks: [{ kind: 'luma', assetId: 'nope' }] })).ok).toBe(false);
    const out = await run('set_mask_stack', { clip_id: 'id1', masks: [{ kind: 'rect', mode: 'subtract', width: 0.2 }, { kind: 'ellipse', mode: 'difference' }] });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.maskStack.map((m) => m.mode)).toEqual(['subtract', 'difference']);
    expect(JSON.stringify(out.doc)).toContain('"maskStack":[{"kind":"rect"');

    await run('remove_mask', { clip_id: 'id1' });
    expect(findClip(session.doc, 'id1')!.clip.maskStack).toEqual([]);
  });

  it('the prompt teaches masks and mattes', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available });

    expect(prompt).toContain('set_mask');
    expect(prompt).toContain('set_track_matte');
  });
});
