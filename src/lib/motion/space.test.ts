import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, setKeyframe, type OpResult } from './timeline';
import { setClipFlags } from './organize';
import { EditMode } from './edit-mode';
import { aabb, quadOf } from './scene-select';
import { Axis, Edge, alignSpace, distributeSpace, moveBy, propBoxes, tidySpace } from './space';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const W = 1920;
const H = 1080;

const shape = (doc: MotionDoc, id: string, x: number, width: number, y = 0.5) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x, y, width, height: 0.1 } }, id));

const base = [
  ['a', 0.2, 0.1, 0.3],
  ['b', 0.45, 0.2, 0.5],
  ['c', 0.9, 0.1, 0.7]
].reduce((doc, [id, x, width, y]) => shape(doc, id as string, x as number, width as number, y as number), newMotionDoc(MotionFormat.Landscape));

const animatedX = () => must(setKeyframe(must(setKeyframe(base, 'a', 'x', 0, 0)), 'a', 'x', 30, 0.1));

const bounds = (doc: MotionDoc, id: string) => aabb(quadOf(doc, id, 0, propBoxes(doc)[id]));

describe('moving by pixels', () => {
  it('one pixel right is one pixel in the frame', () => {
    const moved = must(moveBy(base, ['a'], 0, [1, 0], EditMode.Design));

    expect(bounds(moved, 'a').left - bounds(base, 'a').left).toBeCloseTo(1, 5);
    expect(bounds(moved, 'a').top).toBeCloseTo(bounds(base, 'a').top, 5);
  });

  it('in Design an animated position moves its whole path', () => {
    const animated = animatedX();
    const moved = must(moveBy(animated, ['a'], 10, [W / 10, 0], EditMode.Design));
    const track = moved.tracks.flatMap((t) => t.clips).find((c) => c.id === 'a')!.keyframes.x!;

    expect(track.map((k) => k.value)).toEqual([0.1, 0.2]);
  });

  it('in Motion an animated position is keyed at the playhead', () => {
    const animated = animatedX();
    const moved = must(moveBy(animated, ['a'], 15, [W / 10, 0], EditMode.Motion));
    const track = moved.tracks.flatMap((t) => t.clips).find((c) => c.id === 'a')!.keyframes.x!;

    expect(track).toHaveLength(3);
    expect(track[0].value).toBe(0);
  });

  it('a locked clip does not move', () => {
    const locked = must(setClipFlags(base, 'a', { locked: true }));

    expect(moveBy(locked, ['a'], 0, [1, 0], EditMode.Design).ok).toBe(false);
  });
});

describe('align', () => {
  it('several clips line up on the edge of the selection', () => {
    const aligned = must(alignSpace(base, ['a', 'b'], 0, propBoxes(base), Edge.Left, EditMode.Design));

    expect(bounds(aligned, 'b').left).toBeCloseTo(bounds(base, 'a').left, 5);
    expect(bounds(aligned, 'a').left).toBeCloseTo(bounds(base, 'a').left, 5);
  });

  it('centres line up on the middle of the selection', () => {
    const aligned = must(alignSpace(base, ['a', 'b', 'c'], 0, propBoxes(base), Edge.Middle, EditMode.Design));
    const mid = (id: string) => (bounds(aligned, id).top + bounds(aligned, id).bottom) / 2;

    expect(mid('a')).toBeCloseTo(mid('c'), 5);
    expect(mid('b')).toBeCloseTo(H / 2, 5);
  });

  it('one clip aligns to the frame', () => {
    const aligned = must(alignSpace(base, ['c'], 0, propBoxes(base), Edge.Right, EditMode.Design));

    expect(bounds(aligned, 'c').right).toBeCloseTo(W, 5);
  });
});

describe('distribute', () => {
  it('spreads the gaps evenly between the outer clips', () => {
    const spread = must(distributeSpace(base, ['c', 'a', 'b'], 0, propBoxes(base), Axis.X, EditMode.Design));
    const [a, b, c] = ['a', 'b', 'c'].map((id) => bounds(spread, id));

    expect(b.left - a.right).toBeCloseTo(c.left - b.right, 5);
    expect(a.left).toBeCloseTo(bounds(base, 'a').left, 5);
    expect(c.right).toBeCloseTo(bounds(base, 'c').right, 5);
  });

  it('needs three clips', () => {
    expect(distributeSpace(base, ['a', 'b'], 0, propBoxes(base), Axis.X, EditMode.Design).ok).toBe(false);
  });
});

describe('tidy up inside a frame', () => {
  it('lays a row out with even gaps and keeps the first clip where it is', () => {
    const row = [
      ['a', 0.1, 0.1],
      ['b', 0.3, 0.1],
      ['c', 0.7, 0.1]
    ].reduce((doc, [id, x, width]) => shape(doc, id as string, x as number, width as number), newMotionDoc(MotionFormat.Landscape));
    const tidied = must(tidySpace(row, ['a', 'b', 'c'], 0, propBoxes(row), EditMode.Design));
    const lefts = ['a', 'b', 'c'].map((id) => Math.round(bounds(tidied, id).left));
    expect(lefts[0]).toBe(Math.round(bounds(row, 'a').left));
    expect(lefts[2] - lefts[1]).toBe(lefts[1] - lefts[0]);
  });
});
