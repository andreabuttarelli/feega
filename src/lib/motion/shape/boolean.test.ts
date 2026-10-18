import { describe, expect, it } from 'vitest';
import { BooleanOp, combineShapes, polygonArea } from './boolean';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, addTrack, type OpResult } from '../timeline';
import { TrackKind } from '../components';
import { parsePath, flatten } from './geometry';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const square = (x: number) => ({ component: 'Shape' as const, from: 0, durationInFrames: 60, props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.2 * (16 / 9) } });

function overlapping(): MotionDoc {
  const bottom = ok(addClip(newMotionDoc(MotionFormat.Landscape), square(0.4), 'bottom'));
  const withTop = ok(addTrack(bottom, TrackKind.Visual, 'upper'));
  return ok(addClip(withTop, { ...square(0.5), trackId: 'upper' }, 'top'));
}

function areaOf(doc: MotionDoc): number {
  const clip = findClip(doc, 'bottom')!.clip;
  const outline = parsePath(String(clip.props.path));
  if (typeof outline === 'string') {
    throw new Error(outline);
  }
  return outline.reduce((sum, c) => sum + polygonArea(flatten(c)), 0);
}

describe('boolean operations on shapes', () => {
  it('union keeps the bottom shape as one path covering both, and drops the top one', () => {
    const doc = ok(combineShapes(overlapping(), ['top', 'bottom'], BooleanOp.Union, 0));
    expect(findClip(doc, 'top')).toBeNull();
    expect(findClip(doc, 'bottom')!.clip.props.shape).toBe('path');
    expect(areaOf(doc)).toBeCloseTo(1.5, 2);
  });

  it('subtract cuts the upper shapes out of the bottom one', () => {
    expect(areaOf(ok(combineShapes(overlapping(), ['top', 'bottom'], BooleanOp.Subtract, 0)))).toBeCloseTo(0.5, 2);
  });

  it('intersect keeps only the overlap', () => {
    expect(areaOf(ok(combineShapes(overlapping(), ['top', 'bottom'], BooleanOp.Intersect, 0)))).toBeCloseTo(0.5, 2);
  });

  it('exclude keeps what only one of them covers', () => {
    expect(areaOf(ok(combineShapes(overlapping(), ['top', 'bottom'], BooleanOp.Exclude, 0)))).toBeCloseTo(1, 2);
  });

  it('needs two shapes', () => {
    expect(combineShapes(overlapping(), ['top'], BooleanOp.Union, 0).ok).toBe(false);
  });

  it('refuses a layer that is not a shape', () => {
    const doc = ok(addClip(overlapping(), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hi' } }, 'words'));
    expect(combineShapes(doc, ['top', 'words'], BooleanOp.Union, 0).ok).toBe(false);
  });

  it('refuses an intersection that leaves nothing', () => {
    const apart = ok(addClip(ok(addClip(newMotionDoc(MotionFormat.Landscape), square(0.2), 'bottom')), square(0.8), 'top'));
    expect(combineShapes(apart, ['top', 'bottom'], BooleanOp.Intersect, 0).ok).toBe(false);
  });
});
