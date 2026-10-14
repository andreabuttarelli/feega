import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, addTrack, setKeyframe, setTransform, type OpResult } from './timeline';
import { setParent } from './parent-ops';
import { TrackKind } from './components';
import { Grip, Modifier, PickMode, aabb, pickModeAt, dragPatch, handlesOf, pick, quadOf, readout, remeasured, snapMove, spacing, stackAt, writePatch, type Boxes } from './scene-select';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const W = 1920;
const H = 1080;

const base = (() => {
  let doc = must(
    addClip(
      newMotionDoc(MotionFormat.Landscape),
      {
        component: 'Shape',
        from: 0,
        durationInFrames: 120,
        props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 }
      },
      'back'
    )
  );
  doc = must(addTrack(doc, TrackKind.Visual, 'top'));
  doc = must(
    addClip(
      doc,
      {
        component: 'Shape',
        from: 0,
        durationInFrames: 60,
        trackId: 'top',
        props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1 }
      },
      'front'
    )
  );
  return doc;
})();

const boxes: Boxes = {
  back: { left: 768, top: 432, width: 384, height: 216 },
  front: { left: 864, top: 486, width: 192, height: 108 }
};

const topTrackFirst = (doc: MotionDoc) => doc.tracks.findIndex((t) => t.id === 'top');

describe('the selection box follows the real element', () => {
  it('without transform the quad is the measured box', () => {
    expect(quadOf(base, 'back', 0, boxes.back)).toEqual([
      [768, 432],
      [1152, 432],
      [1152, 648],
      [768, 648]
    ]);
  });

  it('a rotated parent turns the child box around the parent pivot', () => {
    let doc = must(setParent(base, 'front', 'back'));
    doc = must(setTransform(doc, 'back', { rotateZ: 90 }));
    const [a] = quadOf(doc, 'front', 0, boxes.front);

    expect(a[0]).toBeCloseTo(1014, 0);
    expect(a[1]).toBeCloseTo(444, 0);
  });

  it('a keyframed x moves the box at the current frame', () => {
    const doc = must(setKeyframe(must(setKeyframe(base, 'back', 'x', 0, 0)), 'back', 'x', 10, 0.1));

    expect(quadOf(doc, 'back', 10, boxes.back)[0][0]).toBeCloseTo(768 + 192, 3);
  });
});

describe('clicking in the preview', () => {
  it('picks the topmost clip under the pointer, then Alt walks beneath it', () => {
    const stack = stackAt(base, 0, boxes, [960, 540]);

    expect(topTrackFirst(base)).toBe(0);
    expect(stack).toEqual(['front', 'back']);
    expect(pick(stack, null, PickMode.Top)).toBe('front');
    expect(pick(stack, 'front', PickMode.Beneath)).toBe('back');
    expect(pick(stack, 'back', PickMode.Beneath)).toBe('front');
  });

  it('a second tap on the same spot walks beneath, like Alt; a tap elsewhere starts at the top', () => {
    expect(pickModeAt(null, [100, 100], Modifier.None)).toBe(PickMode.Top);
    expect(pickModeAt([100, 100], [104, 98], Modifier.None)).toBe(PickMode.Beneath);
    expect(pickModeAt([100, 100], [300, 100], Modifier.None)).toBe(PickMode.Top);
    expect(pickModeAt(null, [100, 100], Modifier.Alt)).toBe(PickMode.Beneath);
  });

  it('a clip off the playhead cannot be picked', () => {
    expect(stackAt(base, 90, boxes, [960, 540])).toEqual(['back']);
  });

  it('clicking the empty frame deselects', () => {
    expect(pick(stackAt(base, 0, boxes, [10, 10]), 'front', PickMode.Top)).toBeNull();
  });
});

describe('snapping a move', () => {
  it('pulls the box centre onto the frame centre and draws the guide', () => {
    const moving = { left: 100, top: 100, right: 300, bottom: 200 };
    const s = snapMove(moving, [3, 0], [], { width: W, height: H }, 8);

    expect(s.offset).toEqual([3, 0]);

    const near = snapMove({ left: 855, top: 0, right: 1055, bottom: 50 }, [0, 0], [], { width: W, height: H }, 8);

    expect(near.offset[0]).toBe(5);
    expect(near.guides).toContainEqual({ axis: 'x', at: 960 });
  });

  it('snaps to the edges of other clips', () => {
    const other = aabb(quadOf(base, 'back', 0, boxes.back));
    const s = snapMove({ left: 1155, top: 0, right: 1255, bottom: 50 }, [0, 0], [other], { width: W, height: H }, 8);

    expect(s.offset[0]).toBe(-3);
    expect(s.guides).toContainEqual({ axis: 'x', at: 1152 });
  });
});

const drag = (doc: MotionDoc, grip: Grip, from: [number, number], to: [number, number], shift = false, handle = 2) =>
  dragPatch({
    doc,
    clipId: 'back',
    frame: 0,
    box: boxes.back,
    grip,
    handle,
    from,
    to,
    shift,
    snapTargets: [],
    snapPx: 0
  });

describe('dragging a handle', () => {
  it('moving writes x and y in frame fractions', () => {
    const { patch } = drag(base, Grip.Move, [960, 540], [1152, 540]);

    expect(patch.x).toBeCloseTo(0.1, 5);
    expect(patch.y).toBeCloseTo(0, 5);
  });

  it('moving a child of a rotated parent moves it in the parent space', () => {
    let doc = must(setParent(base, 'front', 'back'));
    doc = must(setTransform(doc, 'back', { rotateZ: 90 }));
    const { patch } = dragPatch({
      doc,
      clipId: 'front',
      frame: 0,
      box: boxes.front,
      grip: Grip.Move,
      handle: 0,
      from: [960, 540],
      to: [960, 540 + 192],
      shift: false,
      snapTargets: [],
      snapPx: 0
    });

    expect(patch.x).toBeCloseTo(0.1, 5);
    expect(patch.y).toBeCloseTo(0, 5);
  });

  it('a corner scales both axes freely, Shift keeps the proportions', () => {
    const free = drag(base, Grip.Scale, [1152, 648], [1344, 648]).patch;

    expect(free.scaleX).toBeCloseTo(2, 5);
    expect(free.scaleY).toBeCloseTo(1, 5);

    const locked = drag(base, Grip.Scale, [1152, 648], [1344, 648], true).patch;

    expect(locked.scaleX).toBeCloseTo(locked.scaleY!, 5);
  });

  it('a side scales one axis only', () => {
    const { patch } = drag(base, Grip.Scale, [960, 648], [1300, 756], false, 5);

    expect(patch.scaleX).toBeUndefined();
    expect(patch.scaleY).toBeCloseTo(2, 5);
  });

  it('rotating turns around the anchor, Shift steps by 15°', () => {
    expect(drag(base, Grip.Rotate, [1160, 540], [960, 740]).patch.rotateZ).toBeCloseTo(90, 5);
    expect(drag(base, Grip.Rotate, [1160, 540], [1160, 590], true).patch.rotateZ).toBe(15);
  });

  it('moving the anchor keeps the element where it is', () => {
    const rotated = must(setTransform(base, 'back', { rotateZ: 30 }));
    const before = quadOf(rotated, 'back', 0, boxes.back);
    const { patch } = dragPatch({
      doc: rotated,
      clipId: 'back',
      frame: 0,
      box: boxes.back,
      grip: Grip.Anchor,
      handle: 0,
      from: before[0],
      to: before[0],
      shift: false,
      snapTargets: [],
      snapPx: 0
    });
    const after = quadOf(must(writePatch(rotated, 'back', 0, patch)), 'back', 0, boxes.back);

    expect(patch.anchorX).toBeCloseTo(0, 5);
    expect(after[2][0]).toBeCloseTo(before[2][0], 3);
    expect(after[2][1]).toBeCloseTo(before[2][1], 3);
  });

  it('handles: four corners, four sides, all in screen space', () => {
    const h = handlesOf(quadOf(base, 'back', 0, boxes.back));

    expect(h).toHaveLength(8);
    expect(h[5].at).toEqual([960, 648]);
  });
});

describe('writing a drag', () => {
  it('a property without keyframes gets the static value', () => {
    const doc = must(writePatch(base, 'back', 30, { x: 0.1 }));

    expect(findClip(doc, 'back')?.clip.transform.x).toBe(0.1);
  });

  it('a keyed property gets a keyframe at the playhead, in clip time', () => {
    const keyed = must(setKeyframe(base, 'front', 'x', 0, 0));
    const doc = must(writePatch(keyed, 'front', 20, { x: 0.2, y: 0.1 }));
    const clip = findClip(doc, 'front')!.clip;

    expect(clip.keyframes.x?.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [20, 0.2]
    ]);
    expect(clip.transform.y).toBe(0.1);
  });
});

describe('the readout speaks the editor units', () => {
  it('x in px of the frame, rotation in degrees, scale in %', () => {
    expect(readout('Shape', { x: 0.1, rotateZ: 45, scaleX: 1.5 }, { width: W, height: H })).toBe('x 192 px · rotateZ 45 ° · scaleX 150 %');
  });
});

describe('remeasured', () => {
  const kept: Boxes = { a: { left: 1, top: 2, width: 3, height: 4 } };

  it('a preview still reloading after an edit keeps the boxes it had', () => {
    expect(remeasured(kept, {})).toBe(kept);
  });

  it('a real measure replaces them', () => {
    const next: Boxes = { b: { left: 5, top: 6, width: 7, height: 8 } };
    expect(remeasured(kept, next)).toBe(next);
  });
});

describe('smart guides while resizing', () => {
  it('a dragged corner snaps its edge to a sibling edge and shows the guide', () => {
    const { patch, guides } = dragPatch({ doc: base, clipId: 'back', frame: 0, box: boxes.back, grip: Grip.Scale, handle: 2, from: [1152, 648], to: [1340, 648], shift: false, snapTargets: [{ left: 1344, top: 0, right: 1500, bottom: 100 }], snapPx: 8 });

    expect(patch.scaleX).toBeCloseTo(2, 5);
    expect(guides).toContainEqual({ axis: 'x', at: 1344 });
  });

  it('without snapping the edge follows the pointer', () => {
    expect(drag(base, Grip.Scale, [1152, 648], [1340, 648]).patch.scaleX).toBeCloseTo((1340 - 960) / 192, 5);
  });
});

describe('distance labels', () => {
  const frame = { width: W, height: H };

  it('measure to the nearest neighbour on each side, or to the frame edge', () => {
    const gaps = spacing({ left: 100, top: 100, right: 200, bottom: 200 }, [{ left: 260, top: 120, right: 300, bottom: 180 }], frame);

    expect(gaps).toContainEqual({ axis: 'x', from: 200, to: 260, at: 150 });
    expect(gaps).toContainEqual({ axis: 'x', from: 0, to: 100, at: 150 });
    expect(gaps).toContainEqual({ axis: 'y', from: 0, to: 100, at: 150 });
    expect(gaps).toContainEqual({ axis: 'y', from: 200, to: H, at: 150 });
  });

  it('a sibling that does not face the box is not a neighbour', () => {
    const gaps = spacing({ left: 100, top: 100, right: 200, bottom: 200 }, [{ left: 260, top: 400, right: 300, bottom: 500 }], frame);

    expect(gaps).toContainEqual({ axis: 'x', from: 200, to: W, at: 150 });
  });
});
