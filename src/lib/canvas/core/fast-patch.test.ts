import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { DEFAULT_AUTO_LAYOUT } from '@feega/motion-core/motion/layout/model';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { moveBy } from '$lib/motion/space';
import { EditMode } from '$lib/motion/edit-mode';
import { fastPatch } from './fast-patch';

const SHAPE = { shape: 'rect', x: 0.5, y: 0.5, width: 0.3, height: 0.3, fills: [{ type: 'solid', color: '#ff6a3d' }] };

function built(ids: string[]): MotionDoc {
  return ids.reduce((d, id) => {
    const next = addClip(d, { component: 'Shape', from: 0, durationInFrames: 30, props: SHAPE }, id);
    if (!next.ok) {
      throw new Error(next.error);
    }
    return next.doc;
  }, { ...newMotionDoc(MotionFormat.Square), durationInFrames: 30 } as MotionDoc);
}

const edit = (doc: MotionDoc, id: string, change: (c: MotionClip) => MotionClip): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => (t.clips.some((c) => c.id === id) ? { ...t, clips: t.clips.map((c) => (c.id === id ? change(c) : c)) } : t)) });

const drawn = (doc: MotionDoc) => drawFrame(prepare(doc, FEEGA_TOKENS), 0);

const faded = (opacity: number) => (c: MotionClip) => ({ ...c, transform: { ...c.transform, opacity } });

const hidden = (c: MotionClip) => ({ ...c, hidden: true });

const nested = () => edit(built(['card', 'dot']), 'dot', (c) => ({ ...c, parent: 'card' }));

describe('fastPatch draws a simple edit without rebuilding the frame', () => {
  it('a new opacity gives the list the full build would give', () => {
    const before = built(['a', 'b']);
    const after = edit(before, 'a', faded(0.4));

    expect(fastPatch(drawn(before), before, after)).toEqual(drawn(after));
  });

  it('fading a parent fades its children as the full build does', () => {
    const before = nested();
    const after = edit(before, 'card', faded(0.5));

    expect(fastPatch(drawn(before), before, after)).toEqual(drawn(after));
  });

  it('fading a layer already drawn as one group fades the group as the full build does', () => {
    const before = edit(built(['a']), 'a', (c) => ({ ...faded(0.8)(c), props: { ...c.props, fills: [{ type: 'solid', color: '#ff6a3d' }, { type: 'solid', color: '#0000ff80' }] } }));
    const after = edit(before, 'a', faded(0.4));

    expect(fastPatch(drawn(before), before, after)).toEqual(drawn(after));
  });

  it('hiding a layer drops its items as the full build does', () => {
    const before = nested();
    const after = edit(before, 'card', hidden);

    expect(fastPatch(drawn(before), before, after)).toEqual(drawn(after));
  });

  it('leaves to the full build a layer whose auto layout parent would reflow', () => {
    const before = edit(nested(), 'card', (c) => ({ ...c, autoLayout: DEFAULT_AUTO_LAYOUT }));
    const after = edit(before, 'dot', hidden);

    expect(fastPatch(drawn(before), before, after)).toBeNull();
  });

  it('leaves to the full build an edit that touches two layers', () => {
    const before = built(['a', 'b']);
    const after = edit(edit(before, 'a', faded(0.4)), 'b', faded(0.4));

    expect(fastPatch(drawn(before), before, after)).toBeNull();
  });

  it('leaves to the full build a fade from nothing, which no ratio can scale', () => {
    const before = edit(built(['a']), 'a', faded(0));
    const after = edit(before, 'a', faded(1));

    expect(fastPatch(drawn(before), before, after)).toBeNull();
  });

  const moved = (doc: MotionDoc, id: string) => {
    const r = moveBy(doc, [id], 0, [12, -7], EditMode.Design);
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.doc;
  };

  it('a nudge shifts the layer as the full build does', () => {
    const before = built(['a', 'b']);
    const after = moved(before, 'a');

    expect(fastPatch(drawn(before), before, after)).toEqual(drawn(after));
  });

  it('a nudged parent carries its children as the full build does', () => {
    const before = nested();
    const after = moved(before, 'card');

    expect(fastPatch(drawn(before), before, after)).toEqual(drawn(after));
  });

  it('leaves to the full build a move inside an auto layout parent', () => {
    const before = edit(nested(), 'card', (c) => ({ ...c, autoLayout: DEFAULT_AUTO_LAYOUT }));
    const after = edit(before, 'dot', (c) => ({ ...c, transform: { ...c.transform, x: 0.2 } }));

    expect(fastPatch(drawn(before), before, after)).toBeNull();
  });
});
