import { describe, expect, it } from 'vitest';
import { MotionFormat, compOf, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { TrackKind } from '@feega/motion-core/motion/components';
import { flattenComps } from '@feega/motion-core/motion/precomp';
import { addClip, addTrack, setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { flatten, parsePath } from '@feega/motion-core/motion/shape/geometry';
import { BooleanOp } from '@feega/motion-core/motion/shape/boolean-op';
import { polygonArea } from '@feega/motion-core/motion/shape/boolean';
import { bakeBooleanGroup, isBooleanGroup, liveCombine } from './boolean-group';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const SIDE = { width: 0.2, height: 0.2 * (16 / 9) };
const square = (x: number) => ({ component: 'Shape' as const, from: 0, durationInFrames: 60, props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.2 * (16 / 9), fill: '#ff0000' } });

function overlapping(): MotionDoc {
  const bottom = ok(addClip(newMotionDoc(MotionFormat.Landscape), square(0.4), 'bottom'));
  const withTop = ok(addTrack(bottom, TrackKind.Visual, 'upper'));
  return ok(addClip(withTop, { ...square(0.5), trackId: 'upper' }, 'top'));
}

let n = 0;
const newId = () => `g${++n}`;

const clipsOf = (doc: MotionDoc): MotionClip[] => doc.tracks.flatMap((t) => t.clips) as MotionClip[];

function areaOf(clip: MotionClip): number {
  const outline = parsePath(String(clip.props.path));
  if (typeof outline === 'string') {
    throw new Error(outline);
  }
  const local = outline.reduce((sum, c) => sum + polygonArea(flatten(c)), 0);
  return (local * Number(clip.props.width) * Number(clip.props.height)) / (SIDE.width * SIDE.height);
}

const drawn = (doc: MotionDoc) => clipsOf(flattenComps(doc)).filter((c) => c.component === 'Shape');

describe('live boolean group', () => {
  it('keeps both shapes editable inside a group that draws their union', () => {
    const made = ok(liveCombine(overlapping(), ['bottom', 'top'], BooleanOp.Union, newId));
    const [host] = clipsOf(made);
    expect(isBooleanGroup(host)).toBe(true);
    const inner = made.comps[compOf(host)!].tracks.flatMap((t) => t.clips);
    expect(inner.map((c) => c.id).sort()).toEqual(['bottom', 'top']);

    const shapes = drawn(made);
    expect(shapes).toHaveLength(1);
    expect(areaOf(shapes[0])).toBeCloseTo(1.5, 2);
  });

  it('draws the new result when a child moves', () => {
    const made = ok(liveCombine(overlapping(), ['bottom', 'top'], BooleanOp.Union, newId));
    const compId = compOf(clipsOf(made)[0])!;
    const apart = { ...made, comps: { ...made.comps, [compId]: { ...made.comps[compId], tracks: made.comps[compId].tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'top' ? { ...c, props: { ...c.props, x: 0.8 } } : c)) })) } } };
    expect(areaOf(drawn(apart)[0])).toBeCloseTo(2, 2);
  });

  it('changing the operation redraws the group', () => {
    const made = ok(liveCombine(overlapping(), ['bottom', 'top'], BooleanOp.Intersect, newId));
    expect(areaOf(drawn(made)[0])).toBeCloseTo(0.5, 2);
    const host = clipsOf(made)[0];
    const subtracted = ok(setProps(made, host.id, { boolean: BooleanOp.Subtract }));
    expect(areaOf(drawn(subtracted)[0])).toBeCloseTo(0.5, 2);
    const unioned = ok(setProps(made, host.id, { boolean: BooleanOp.Union }));
    expect(areaOf(drawn(unioned)[0])).toBeCloseTo(1.5, 2);
  });

  it('a plain group draws its children untouched', () => {
    const made = ok(liveCombine(overlapping(), ['bottom', 'top'], BooleanOp.Union, newId));
    const host = clipsOf(made)[0];
    const plain = ok(setProps(made, host.id, { boolean: undefined }));
    expect(isBooleanGroup(clipsOf(plain)[0])).toBe(false);
    expect(drawn(plain)).toHaveLength(2);
  });

  it('flatten bakes the result into one ordinary shape and drops the group', () => {
    const made = ok(liveCombine(overlapping(), ['bottom', 'top'], BooleanOp.Union, newId));
    const baked = ok(bakeBooleanGroup(made, clipsOf(made)[0].id, newId));
    const shapes = clipsOf(baked);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].component).toBe('Shape');
    expect(shapes[0].props.shape).toBe('path');
    expect(areaOf(shapes[0])).toBeCloseTo(1.5, 2);
    expect(Object.keys(baked.comps)).toHaveLength(0);
  });

  it('refuses a single shape', () => {
    expect(liveCombine(overlapping(), ['bottom'], BooleanOp.Union, newId).ok).toBe(false);
  });
});
