import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { Align, Direction, Sizing } from './auto-layout';
import { autoLayoutPatchSchema, layoutItemPatchSchema } from './model';
import { addAutoLayout, leaveAutoLayout, reorderChild, removeAutoLayout, setAutoLayout, setLayoutItem, wrapInAutoLayout, wrapInFrame } from './ops';
import { withAutoLayout } from './resolve';
import { layerOrder } from '../siblings';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const row = (() => {
  let doc = newMotionDoc(MotionFormat.Square);
  doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.2, y: 0.5, width: 0.1, height: 0.1 } }, 'a'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1 } }, 'b'));
  doc = must(addClip(doc, { component: 'Kicker', from: 10, durationInFrames: 90, props: { x: 0.8, y: 0.5, width: 0.1, height: 0.05 } }, 'k'));
  return doc;
})();

const clip = (doc: MotionDoc, id: string) => findClip(doc, id)!.clip;

describe('wrapInAutoLayout', () => {
  const wrapped = must(wrapInAutoLayout(row, ['b', 'k', 'a'], 'box', 'lane'));

  it('creates a container clip on a track below the children, spanning their time', () => {
    const box = clip(wrapped, 'box');
    expect(box.component).toBe('Shape');
    expect([box.from, box.durationInFrames]).toEqual([0, 100]);
    const lane = wrapped.tracks.findIndex((t) => t.id === 'lane');
    const lowest = Math.max(...['a', 'b', 'k'].map((id) => wrapped.tracks.findIndex((t) => t.clips.some((c) => c.id === id))));
    expect(lane).toBe(lowest + 1);
  });

  it('sits directly under its children, above a background sharing their track', () => {
    let doc = newMotionDoc(MotionFormat.Square);
    doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 } }, 'bg'));
    doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.1, height: 0.1 } }, 'a'));
    doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.6, y: 0.5, width: 0.1, height: 0.1 } }, 'b'));
    const order = layerOrder(must(wrapInAutoLayout(doc, ['a', 'b'], 'box', 'lane')));
    expect(order).toEqual(['b', 'a', 'box', 'bg']);
  });

  it('parents the children, in reading order, and guesses the direction and gap', () => {
    const box = clip(wrapped, 'box');
    expect(['a', 'b', 'k'].map((id) => clip(wrapped, id).parent)).toEqual(['box', 'box', 'box']);
    expect(box.autoLayout).toMatchObject({ direction: Direction.Horizontal, order: ['a', 'b', 'k'] });
    expect(box.autoLayout!.gap).toBeCloseTo(((0.45 - 0.25) * 1080 + (0.75 - 0.55) * 1080) / 2, 5);
  });

  it('text hugs its words, the container hugs its children', () => {
    expect(clip(wrapped, 'k').layoutItem).toMatchObject({ width: Sizing.Hug, height: Sizing.Hug });
    expect(clip(wrapped, 'a').layoutItem).toBeUndefined();
    expect(clip(wrapped, 'box').layoutItem).toMatchObject({ width: Sizing.Hug, height: Sizing.Hug });
  });

  it('keeps the first child where it was and produces a valid doc', () => {
    const out = withAutoLayout(wrapped);
    expect(clip(out, 'a').props).toMatchObject({ x: 0.2, y: 0.5 });
    expect(parseMotionDoc(wrapped).ok).toBe(true);
  });

  it('stacks vertically when the clips are above one another', () => {
    let doc = newMotionDoc(MotionFormat.Square);
    doc = must(addClip(doc, { component: 'Shape', from: 0, props: { x: 0.5, y: 0.2, width: 0.3, height: 0.1 } }, 'p'));
    doc = must(addClip(doc, { component: 'Shape', from: 0, props: { x: 0.5, y: 0.6, width: 0.3, height: 0.1 } }, 'q'));
    expect(clip(must(wrapInAutoLayout(doc, ['q', 'p'], 'box', 'lane')), 'box').autoLayout).toMatchObject({ direction: Direction.Vertical, order: ['p', 'q'] });
  });

  it('refuses an audio clip or an empty selection', () => {
    expect(wrapInAutoLayout(row, [], 'box', 'lane').ok).toBe(false);
  });
});

describe('editing a container', () => {
  const wrapped = must(wrapInAutoLayout(row, ['a', 'b'], 'box', 'lane'));

  it('patches the layout and keeps what it does not name', () => {
    const doc = must(setAutoLayout(wrapped, 'box', { gap: 4, padding: { top: 1, right: 2, bottom: 3, left: 4 } }));
    expect(clip(doc, 'box').autoLayout).toMatchObject({ gap: 4, direction: Direction.Horizontal, padding: { top: 1, right: 2, bottom: 3, left: 4 } });
  });

  it('turns a plain box clip into a container, and back', () => {
    const on = must(setAutoLayout(row, 'a', {}));
    expect(clip(on, 'a').autoLayout).toBeTruthy();
    expect(clip(must(setAutoLayout(on, 'a', null)), 'a').autoLayout).toBeNull();
  });

  it('refuses a clip without a box', () => {
    expect(setAutoLayout(must(addClip(row, { component: 'Null', from: 0 }, 'n')), 'n', {}).ok).toBe(false);
  });

  it('sets the sizing of a child', () => {
    expect(clip(must(setLayoutItem(wrapped, 'a', { width: Sizing.Fill })), 'a').layoutItem).toMatchObject({ width: Sizing.Fill, height: Sizing.Fixed });
  });

  it('keeps fill on a clip not yet inside a container, for when it is parented', () => {
    const intended = must(setLayoutItem(row, 'a', { width: Sizing.Fill }));
    expect(clip(must(wrapInAutoLayout(intended, ['a', 'b'], 'box', 'lane')), 'a').layoutItem).toMatchObject({ width: Sizing.Fill });
  });

  it('a new root container aligns its children to the start', () => {
    expect(clip(wrapped, 'box').autoLayout!.align).toBe(Align.Start);
  });

  it('moves a child to a new place in the order', () => {
    expect(clip(must(reorderChild(wrapped, 'box', 'b', 0)), 'box').autoLayout!.order).toEqual(['b', 'a']);
  });

  it('a child that leaves keeps the box it was laid out in', () => {
    const laid = clip(withAutoLayout(wrapped), 'b').props;
    const doc = must(leaveAutoLayout(wrapped, 'b'));
    expect(clip(doc, 'b').parent).toBeNull();
    expect(clip(doc, 'b').props).toMatchObject({ x: laid.x, y: laid.y, width: laid.width, height: laid.height });
    expect(clip(doc, 'box').autoLayout!.order).toEqual(['a']);
  });
});

describe('the patch schemas', () => {
  it('fill in nothing the caller did not send', () => {
    expect(autoLayoutPatchSchema.parse({ gap: 3 })).toEqual({ gap: 3 });
    expect(autoLayoutPatchSchema.parse({ gap: -8, justify: 'space-evenly' })).toEqual({ gap: -8, justify: 'space-evenly' });
    expect(layoutItemPatchSchema.parse({})).toEqual({});
  });
});

describe('addAutoLayout (⇧A)', () => {
  let n = 0;
  const newId = () => `n${++n}`;

  it('wraps a selection in a new container', () => {
    const { result, containerId } = addAutoLayout(row, ['a', 'b'], newId);
    expect(clip(must(result), 'a').parent).toBe(containerId);
  });

  it('turns a lone clip that already has children into the container', () => {
    const wrapped = must(wrapInAutoLayout(row, ['a', 'b'], 'box', 'lane'));
    const plain = must(setAutoLayout(wrapped, 'box', null));
    const { result, containerId } = addAutoLayout(plain, ['box'], newId);
    expect(containerId).toBe('box');
    expect(clip(must(result), 'box').autoLayout).toBeTruthy();
  });
});

describe('wrapInFrame', () => {
  const framed = must(wrapInFrame(row, ['a', 'b'], 'box', 'lane'));

  it('parents the clips to a plain container that covers them', () => {
    expect(['a', 'b'].map((id) => clip(framed, id).parent)).toEqual(['box', 'box']);
    expect(clip(framed, 'box').autoLayout).toBeFalsy();
  });

  it('leaves the children where they were', () => {
    expect(clip(framed, 'a').props.x).toBe(0.2);
    expect(clip(framed, 'b').layoutItem).toBeFalsy();
  });
});

describe('removeAutoLayout', () => {
  const laid = must(wrapInAutoLayout(row, ['a', 'b'], 'box', 'lane'));
  const removed = must(removeAutoLayout(laid, 'box'));

  it('turns the container into a plain frame', () => {
    expect(clip(removed, 'box').autoLayout).toBeFalsy();
  });

  it('keeps the children in place, with the boxes the layout gave them', () => {
    const was = clip(withAutoLayout(laid), 'b').props;

    expect(clip(removed, 'b').parent).toBe('box');
    expect(clip(removed, 'b').props).toMatchObject({ x: was.x, y: was.y, width: was.width, height: was.height });
  });

  it('refuses a clip that is not an auto layout', () => {
    expect(removeAutoLayout(row, 'a').ok).toBe(false);
  });
});
