import { describe, expect, it, vi } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM } from '@feega/motion-core/motion/layout/model';
import { Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { estimatedText } from '@feega/motion-core/motion/layout/text-extent';
import * as resolve from '@feega/motion-core/motion/layout/resolve';

vi.mock('@feega/motion-core/motion/layout/resolve', async (original) => {
  const real = await original<typeof import('@feega/motion-core/motion/layout/resolve')>();
  return { ...real, withAutoLayout: vi.fn(real.withAutoLayout), relaidWithin: vi.fn(real.relaidWithin) };
});

const { fastPatch } = await import('./fast-patch');

const SHAPE = { shape: 'rect', x: 0.5, y: 0.5, width: 0.05, height: 0.05, fills: [{ type: 'solid', color: '#ff6a3d' }] };
const LOOK = { tokens: FEEGA_TOKENS, assets: {}, frame: 0 };

const edit = (doc: MotionDoc, id: string, change: (c: MotionClip) => MotionClip): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? change(c) : c)) })) });

function stack(): MotionDoc {
  const doc = ['card', 'a', 'b', 'c'].reduce((d, id) => {
    const next = addClip(d, { component: 'Shape', from: 0, durationInFrames: 30, props: SHAPE }, id);
    if (!next.ok) {
      throw new Error(next.error);
    }
    return next.doc;
  }, { ...newMotionDoc(MotionFormat.Square), durationInFrames: 30 } as MotionDoc);
  const parented = ['a', 'b', 'c'].reduce((d, id) => edit(d, id, (c) => ({ ...c, parent: 'card' })), doc);
  return edit(parented, 'card', (c) => ({ ...c, autoLayout: { ...DEFAULT_AUTO_LAYOUT, gap: 8 }, layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Hug } }));
}

describe('fastPatch layouts', () => {
  it('does not lay out the frame again for a hide that follows a patched resize', () => {
    const first = stack();
    const resized = edit(first, 'a', (c) => ({ ...c, props: { ...c.props, width: 0.1 } }));
    const list = fastPatch(drawFrame(prepare(first, FEEGA_TOKENS), 0), first, resized, estimatedText, LOOK);
    expect(list).not.toBeNull();
    const hidden = edit(resized, 'b', (c) => ({ ...c, hidden: true }));
    vi.mocked(resolve.withAutoLayout).mockClear();

    fastPatch(list!, resized, hidden, estimatedText, LOOK);

    const laysOutContainers = vi.mocked(resolve.withAutoLayout).mock.calls.filter(([doc]) => doc.tracks.some((t) => t.clips.some((c) => c.autoLayout)));
    expect(laysOutContainers).toEqual([]);
  });

  it('does not lay out the whole parent of a hidden layer when it can redraw the reflow', () => {
    const first = stack();
    const list = drawFrame(prepare(first, FEEGA_TOKENS), 0);
    const warm = edit(first, 'a', (c) => ({ ...c, props: { ...c.props, width: 0.1 } }));
    const patched = fastPatch(list, first, warm, estimatedText, LOOK);
    vi.mocked(resolve.relaidWithin).mockClear();

    fastPatch(patched!, warm, edit(warm, 'b', (c) => ({ ...c, hidden: true })), estimatedText, LOOK);

    expect(vi.mocked(resolve.relaidWithin)).not.toHaveBeenCalled();
  });
});
