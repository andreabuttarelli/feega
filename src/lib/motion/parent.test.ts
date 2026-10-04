import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { DOC_VERSION, MotionFormat, findClip, newMotionDoc, parseMotionDoc, upgradeDoc, type MotionDoc } from './doc';
import { ParentOpacity, ancestorsOf, apply2d, childrenOf, parentChoices, worldAt } from './parent';
import { KeepWorld, addNull, nullFromSelection, setParent, setParentOpacity } from './parent-ops';
import { addClip, setKeyframes, setTransform, type OpResult } from './timeline';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const W = 1920;
const H = 1080;

const base = (() => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 120, props: { shape: 'rect', x: 0.25, y: 0.5, width: 0.1, height: 0.1 } }, 'card'));
  doc = must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 120, props: { x: 0.25, y: 0.7, width: 0.3, height: 0.1 } }, 'caption'));
  doc = must(addClip(doc, { component: 'Image', from: 30, durationInFrames: 60, props: { x: 0.7, y: 0.5, width: 0.3, height: 0.5 } }, 'product'));
  return doc;
})();

const near = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0], 1);
  expect(a[1]).toBeCloseTo(b[1], 1);
};

describe('a null in the doc', () => {
  it('a version 4 doc gains no parents', () => {
    const v4 = { ...newMotionDoc(MotionFormat.Landscape), version: 4, tracks: [{ id: 'v1', kind: 'visual', name: '', clips: [{ id: 'a', from: 0, durationInFrames: 30, component: 'Title', props: {} }] }] };
    const up = upgradeDoc(v4) as MotionDoc;

    expect(DOC_VERSION).toBe(5);
    expect(up.tracks[0].clips[0]).toMatchObject({ parent: null, parentOpacity: ParentOpacity.Inherit });
  });

  it('is an invisible clip with a pivot and full transform keyframes', () => {
    const doc = must(addNull(base, { from: 0, durationInFrames: 120, x: 0.4, y: 0.5 }, 'rig'));
    const rig = findClip(doc, 'rig')!.clip;

    expect(rig).toMatchObject({ component: 'Null', props: { x: 0.4, y: 0.5 } });
    expect(must(setKeyframes(doc, 'rig', 'rotateZ', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 60, value: 90, ease: Ease.Linear }])).tracks).toBeTruthy();
  });

  it('refuses a cycle, a missing parent and a parent on itself, also when a saved doc carries one', () => {
    let doc = must(setParent(base, 'caption', 'card'));

    expect(setParent(doc, 'card', 'caption')).toMatchObject({ ok: false });
    expect(setParent(doc, 'card', 'card')).toMatchObject({ ok: false });
    expect(setParent(doc, 'card', 'ghost')).toMatchObject({ ok: false });

    doc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'card' ? { ...c, parent: 'caption' } : c)) })) };
    expect(parseMotionDoc(doc)).toMatchObject({ ok: false });
  });

  it('knows the chain of ancestors, outermost first, and the children', () => {
    let doc = must(addNull(base, { from: 0, durationInFrames: 120 }, 'rig'));
    doc = must(setParent(doc, 'card', 'rig'));
    doc = must(setParent(doc, 'caption', 'card'));

    expect(ancestorsOf(doc, 'caption')).toEqual(['rig', 'card']);
    expect(childrenOf(doc, 'rig')).toEqual(['card']);
  });
});

describe('composing transforms', () => {
  it('a child moves and turns with its parent, around the parent pivot', () => {
    let doc = must(addNull(base, { from: 0, durationInFrames: 120, x: 0.5, y: 0.5 }, 'rig'));
    doc = must(setParent(doc, 'card', 'rig'));
    doc = must(setTransform(doc, 'rig', { rotateZ: 90, x: 0.1 }));

    const centre = apply2d(worldAt(doc, 'card', 0, { width: W, height: H }), [0.25 * W, 0.5 * H]);

    near(centre, [0.5 * W + 0.1 * W, 0.5 * H - 0.25 * W]);
  });

  it('a parent outside its own time range still drives the child, held at its nearest keyframe', () => {
    let doc = must(addNull(base, { from: 30, durationInFrames: 30 }, 'rig'));
    doc = must(setParent(doc, 'caption', 'rig'));
    doc = must(setKeyframes(doc, 'rig', 'x', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 30, value: 0.2, ease: Ease.Linear }]));
    const at = (frame: number) => apply2d(worldAt(doc, 'caption', frame, { width: W, height: H }), [0, 0])[0];

    expect(at(0)).toBeCloseTo(0, 6);
    expect(at(45)).toBeCloseTo(0.1 * W, 3);
    expect(at(110)).toBeCloseTo(0.2 * W, 3);
  });

  it('parenting keeps the child where it is on screen, and so does unparenting', () => {
    let doc = must(addNull(base, { from: 0, durationInFrames: 120, x: 0.5, y: 0.5 }, 'rig'));
    doc = must(setTransform(doc, 'rig', { rotateZ: 30, x: 0.05, scale: 1.5 }));
    const frame = { width: W, height: H };
    const before = apply2d(worldAt(doc, 'product', 40, frame), [0.7 * W, 0.5 * H]);

    doc = must(setParent(doc, 'product', 'rig', { at: 40, keep: KeepWorld.Yes }));
    near(apply2d(worldAt(doc, 'product', 40, frame), [0.7 * W, 0.5 * H]), before);

    doc = must(setParent(doc, 'product', null, { at: 40, keep: KeepWorld.Yes }));
    near(apply2d(worldAt(doc, 'product', 40, frame), [0.7 * W, 0.5 * H]), before);
    expect(findClip(doc, 'product')!.clip.parent).toBeNull();
  });

  it('keeping the world position shifts a keyed child lane by the same amount', () => {
    let doc = must(addNull(base, { from: 0, durationInFrames: 120 }, 'rig'));
    doc = must(setTransform(doc, 'rig', { x: 0.1 }));
    doc = must(setKeyframes(doc, 'card', 'x', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 60, value: 0.2, ease: Ease.Linear }]));
    doc = must(setParent(doc, 'card', 'rig', { at: 0, keep: KeepWorld.Yes }));

    expect(findClip(doc, 'card')!.clip.keyframes.x!.map((k) => k.value)).toEqual([-0.1, 0.1]);
  });
});

describe('choosing a parent', () => {
  it('offers every visual clip except the clip itself and its descendants', () => {
    let doc = must(addNull(base, { from: 0, durationInFrames: 120 }, 'rig'));
    doc = must(setParent(doc, 'card', 'rig'));

    expect(parentChoices(doc, 'rig').sort()).toEqual(['caption', 'product']);
    expect(parentChoices(doc, 'card').sort()).toEqual(['caption', 'product', 'rig']);
  });
});

describe('a null from the selection', () => {
  it('lands at the centre of the selected clips, spans them, and parents them without moving them', () => {
    const frame = { width: W, height: H };
    const before = apply2d(worldAt(base, 'card', 40, frame), [0.25 * W, 0.5 * H]);
    const result = nullFromSelection(base, ['card', 'caption', 'product'], 40, 'rig');
    const doc = must(result);
    const rig = findClip(doc, 'rig')!.clip;

    expect(rig).toMatchObject({ component: 'Null', from: 0, durationInFrames: 120 });
    expect(rig.props.x).toBeCloseTo((0.1 + 0.85) / 2, 6);
    expect(rig.props.y).toBeCloseTo((0.25 + 0.75) / 2, 6);
    expect(childrenOf(doc, 'rig').sort()).toEqual(['caption', 'card', 'product']);
    near(apply2d(worldAt(doc, 'card', 40, frame), [0.25 * W, 0.5 * H]), before);
  });

  it('a child can ignore the opacity of its parent', () => {
    let doc = must(setParent(base, 'caption', 'card'));
    doc = must(setParentOpacity(doc, 'caption', ParentOpacity.Ignore));

    expect(findClip(doc, 'caption')!.clip.parentOpacity).toBe(ParentOpacity.Ignore);
  });
});
