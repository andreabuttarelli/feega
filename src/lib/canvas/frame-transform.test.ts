import { describe, expect, it } from 'vitest';
import { EditMode } from '$lib/motion/edit-mode';
import { Ease } from '@feega/motion-core/motion/design';
import { setKeyframes } from '@feega/motion-core/motion/timeline';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
import { setClipFlags } from '@feega/motion-core/motion/organize';
import { Grip, aabb, handlesOf, quadOf, type Bounds } from '$lib/motion/scene-select';
import { guessedBoxes } from '$lib/motion/move-element';
import { transformAt } from '@feega/motion-core/motion/parent';
import { GuideAlign, GuideKind, newGuide, setLayoutGuides } from '$lib/motion/layout-guides/guides';
import { wrapInStack } from '$lib/motion/layout/ops';
import { SnapMode, dragClips, measuredGaps, nudgeClips, type Drag } from './frame-transform';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = (x: number) => ({ component: 'Shape', from: 0, durationInFrames: 900, props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.2 } }) as const;
const DOC = must(addClip(must(addClip(newMotionDoc(MotionFormat.Landscape), shape(0.5), 'card')), shape(0.85), 'side'));
const BOXES = guessedBoxes(DOC);
const NO_KEYS = { shift: false, alt: false };
const REACH = 8;
const CORNER_BOTTOM_RIGHT = 2;

const drag = (over: Partial<Drag>): Drag => ({ doc: DOC, ids: ['card'], frame: 0, boxes: BOXES, grip: Grip.Move, handle: 0, from: [900, 500], to: [900, 500], keys: NO_KEYS, reach: REACH, mode: EditMode.Motion, ...over });
const boundsOf = (doc: MotionDoc, id: string): Bounds => aabb(quadOf(doc, id, 0, BOXES[id]));
const centre = (b: Bounds) => [(b.left + b.right) / 2, (b.top + b.bottom) / 2];

describe('dragClips', () => {
  it('snaps a moved element to the edge of a sibling and shows the guide', () => {
    const before = boundsOf(DOC, 'card');
    const near = boundsOf(DOC, 'side').left - before.right - 3;

    const { result, guides } = dragClips(drag({ to: [900 + near, 500] }));

    expect(boundsOf(must(result), 'card').right).toBeCloseTo(boundsOf(DOC, 'side').left);
    expect(guides).toContainEqual({ axis: 'x', at: boundsOf(DOC, 'side').left });
  });

  it('snaps a moved element to the edge of a layout guide, shown or hidden', () => {
    const guided = must(setLayoutGuides(DOC, [{ ...newGuide(GuideKind.Columns), align: GuideAlign.Min, count: 1, size: 100, offset: 1000, hidden: true }]));
    const near = 1003 - boundsOf(guided, 'card').right;

    const { result } = dragClips(drag({ doc: guided, to: [900 + near, 500] }));

    expect(boundsOf(must(result), 'card').right).toBeCloseTo(1000);
  });

  it('suspends snapping and shows no guide when snapping is off', () => {
    const before = boundsOf(DOC, 'card');
    const near = boundsOf(DOC, 'side').left - before.right - 3;

    const { result, guides } = dragClips(drag({ to: [900 + near, 500], snap: SnapMode.Off }));

    expect(guides).toEqual([]);
    expect(boundsOf(must(result), 'card').right).toBeCloseTo(boundsOf(DOC, 'side').left - 3);
  });

  it('lands a moved element on whole pixels in pixel mode', () => {
    const { result } = dragClips(drag({ to: [900.4, 500.3], snap: SnapMode.Pixels, reach: 0 }));
    const after = boundsOf(must(result), 'card');

    expect(after.left).toBeCloseTo(Math.round(after.left));
    expect(after.top).toBeCloseTo(Math.round(after.top));
  });

  it('locks a Shift move to the dominant axis', () => {
    const { result } = dragClips(drag({ to: [1000, 530], keys: { shift: true, alt: false }, reach: 0 }));

    expect(centre(boundsOf(must(result), 'card'))[1]).toBeCloseTo(centre(boundsOf(DOC, 'card'))[1]);
  });

  describe('a locked aspect ratio', () => {
    const lockedDoc = must(setClipFlags(DOC, 'card', { lockRatio: true }));
    const corner = boundsOf(lockedDoc, 'card');
    const resize = (keys: Drag['keys']) => {
      const { result } = dragClips(drag({ doc: lockedDoc, grip: Grip.Scale, handle: CORNER_BOTTOM_RIGHT, from: [corner.right, corner.bottom], to: [corner.right + 80, corner.bottom + 5], keys, reach: 0 }));
      const after = boundsOf(must(result), 'card');
      return (after.right - after.left) / (after.bottom - after.top);
    };
    const ratio = (corner.right - corner.left) / (corner.bottom - corner.top);

    it('keeps the ratio when a corner is dragged without Shift', () => {
      expect(resize(NO_KEYS)).toBeCloseTo(ratio, 3);
    });

    it('Ctrl unlocks it for the drag', () => {
      expect(Math.abs(resize({ shift: false, alt: false, ctrl: true }) - ratio)).toBeGreaterThan(0.1);
    });
  });

  it('resizes from the centre while Alt is held', () => {
    const corner = boundsOf(DOC, 'card');

    const { result } = dragClips(drag({ grip: Grip.Scale, handle: CORNER_BOTTOM_RIGHT, from: [corner.right, corner.bottom], to: [corner.right + 50, corner.bottom + 30], keys: { shift: false, alt: true }, reach: 0 }));

    const after = boundsOf(must(result), 'card');
    expect(centre(after)[0]).toBeCloseTo(centre(corner)[0]);
    expect(after.right - after.left).toBeCloseTo(corner.right - corner.left + 100);
  });

  it('Alt-resizes a rotated element along its own sides, from its centre', () => {
    const turned = must(setTransform(DOC, 'card', { rotateZ: 90 }));
    const side = handlesOf(quadOf(turned, 'card', 0, BOXES.card)).findIndex((h) => h.unit[0] === 1 && h.unit[1] === 0.5);
    const at = handlesOf(quadOf(turned, 'card', 0, BOXES.card))[side].at;

    const { result } = dragClips(drag({ doc: turned, grip: Grip.Scale, handle: side, from: at, to: [at[0], at[1] + 40], keys: { shift: false, alt: true }, reach: 0 }));

    const card = findClip(must(result), 'card')!.clip;
    expect(transformAt(card, 'rotateZ', 0)).toBe(90);
    expect(transformAt(card, 'scaleX', 0)).toBeGreaterThan(1);
    expect(transformAt(card, 'scaleY', 0)).toBeCloseTo(1);
    expect(centre(aabb(quadOf(must(result), 'card', 0, BOXES.card)))).toEqual(centre(aabb(quadOf(turned, 'card', 0, BOXES.card))).map((n) => expect.closeTo(n, 5)));
  });

  it('resizes several elements as one group', () => {
    const group = { left: boundsOf(DOC, 'card').left, right: boundsOf(DOC, 'side').right, top: boundsOf(DOC, 'card').top, bottom: boundsOf(DOC, 'card').bottom };

    const { result } = dragClips(drag({ ids: ['card', 'side'], grip: Grip.Scale, handle: CORNER_BOTTOM_RIGHT, from: [group.right, group.bottom], to: [group.right + 100, group.bottom], reach: 0 }));

    expect(boundsOf(must(result), 'card').left).toBeCloseTo(group.left);
    expect(boundsOf(must(result), 'side').right).toBeCloseTo(group.right + 100);
  });

  it('rotates an element around its anchor', () => {
    const c = centre(boundsOf(DOC, 'card'));

    const { result } = dragClips(drag({ grip: Grip.Rotate, from: [c[0] + 100, c[1]], to: [c[0], c[1] + 100] }));

    expect(transformAt(findClip(must(result), 'card')!.clip, 'rotateZ', 0)).toBeCloseTo(90);
  });

  it('refuses a clip that is not in the doc', () => {
    expect(dragClips(drag({ ids: ['gone'], to: [1, 1] })).result.ok).toBe(false);
  });
});

describe('Design and Animate mode', () => {
  const slide = must(
    setKeyframes(DOC, 'card', 'x', [
      { frame: 0, value: 0.3, ease: Ease.Linear },
      { frame: 40, value: 0.6, ease: Ease.Linear }
    ])
  );
  const keysOf = (doc: MotionDoc) => findClip(doc, 'card')!.clip.keyframes.x.map((k) => [k.frame, k.value]);
  const moveRight = (mode: EditMode) => dragClips(drag({ doc: slide, frame: 20, mode, reach: 0, from: [0, 0], to: [192, 0] })).result;

  it('Animate keys the moved prop at the playhead', () => {
    expect(keysOf(must(moveRight(EditMode.Motion))).map(([frame]) => frame)).toEqual([0, 20, 40]);
  });

  it('Design adds no key: the whole animation shifts by the move', () => {
    const next = keysOf(must(moveRight(EditMode.Design)));

    expect(next.map(([frame]) => frame)).toEqual([0, 40]);
    expect(next[0][1]).toBeCloseTo(0.4);
    expect(next[1][1]).toBeCloseTo(0.7);
  });

  it('Motion keys an element that was not animated: its start stays, the move lands at the playhead', () => {
    const moved = must(dragClips(drag({ frame: 20, reach: 0, from: [0, 0], to: [192, 0] })).result);
    const keys = keysOf(moved);

    expect(keys.map(([frame]) => frame)).toEqual([0, 20]);
    expect(keys[0][1]).toBeCloseTo(transformAt(findClip(DOC, 'card')!.clip, 'x', 0));
    expect(keys[1][1]).toBeGreaterThan(Number(keys[0][1]));
  });

  it('Motion at the start of an element keys only that frame', () => {
    expect(keysOf(must(dragClips(drag({ frame: 0, reach: 0, from: [0, 0], to: [192, 0] })).result)).map(([frame]) => frame)).toEqual([0]);
  });

  it('Design moves an element that was not animated without keying it', () => {
    expect(findClip(must(dragClips(drag({ frame: 20, mode: EditMode.Design, reach: 0, from: [0, 0], to: [192, 0] })).result), 'card')!.clip.keyframes.x).toBeUndefined();
  });

  it('Design nudges an animated element without keying it', () => {
    const next = must(nudgeClips(slide, ['card'], 20, [19.2, 0], EditMode.Design));

    expect(keysOf(next).map(([frame]) => frame)).toEqual([0, 40]);
  });
});

describe('nudgeClips', () => {
  it('moves the picked elements by whole frame pixels', () => {
    const before = boundsOf(DOC, 'card');

    const after = boundsOf(must(nudgeClips(DOC, ['card'], 0, [10, -1], EditMode.Motion)), 'card');

    expect(after.left - before.left).toBeCloseTo(10);
    expect(after.top - before.top).toBeCloseTo(-1);
  });
});

describe('measuredGaps', () => {
  it('measures the gap between the picked and the hovered element', () => {
    const gaps = measuredGaps(DOC, 0, BOXES, ['card'], 'side');

    expect(gaps).toEqual([expect.objectContaining({ axis: 'x', from: boundsOf(DOC, 'card').right, to: boundsOf(DOC, 'side').left })]);
  });

  it('measures nothing over the picked element itself', () => {
    expect(measuredGaps(DOC, 0, BOXES, ['card'], 'card')).toEqual([]);
  });

  it('a corner drag keeps the opposite corner fixed', () => {
    const before = boundsOf(DOC, 'card');
    const corner = handlesOf([[before.left, before.top], [before.right, before.top], [before.right, before.bottom], [before.left, before.bottom]])[CORNER_BOTTOM_RIGHT].at;
    const { result } = dragClips(drag({ grip: Grip.Scale, handle: CORNER_BOTTOM_RIGHT, from: corner, to: [corner[0] + 60, corner[1] + 40], reach: 0 }));
    const after = boundsOf(must(result), 'card');
    expect(after.left).toBeCloseTo(before.left);
    expect(after.top).toBeCloseTo(before.top);
    expect(after.right).toBeCloseTo(before.right + 60);
    expect(after.bottom).toBeCloseTo(before.bottom + 40);
  });

  it('a side drag resizes only that side', () => {
    const before = boundsOf(DOC, 'card');
    const RIGHT_SIDE = handlesOf([[0, 0], [1, 0], [1, 1], [0, 1]]).findIndex((h) => h.unit[0] === 1 && h.unit[1] === 0.5);
    const from: [number, number] = [before.right, (before.top + before.bottom) / 2];
    const { result } = dragClips(drag({ grip: Grip.Scale, handle: RIGHT_SIDE, from, to: [from[0] + 50, from[1] + 30], reach: 0 }));
    const after = boundsOf(must(result), 'card');
    expect(after.left).toBeCloseTo(before.left);
    expect(after.right).toBeCloseTo(before.right + 50);
    expect(after.top).toBeCloseTo(before.top);
    expect(after.bottom).toBeCloseTo(before.bottom);
  });
});

describe('arrow keys on a stack child', () => {
  const stacked = must(wrapInStack(DOC, ['card', 'side'], 'row', 'lane'));
  const order = (doc: MotionDoc) => findClip(doc, 'row')?.clip.autoLayout?.order;

  it('reorder it along the stack instead of nudging it', () => {
    const next = must(nudgeClips(stacked, ['card'], 0, [1, 0], EditMode.Design));
    expect(order(next)).toEqual(['side', 'card']);
    expect(findClip(next, 'card')?.clip.props.y).toBe(findClip(stacked, 'card')?.clip.props.y);
  });

  it('do nothing across the stack', () => {
    expect(nudgeClips(stacked, ['card'], 0, [0, 1], EditMode.Design).ok).toBe(false);
  });
});
