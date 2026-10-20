import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { Handle } from './pen';
import { PointOp, editPathPoints, type PointEdit } from './point-ops';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const withShape = (props: Record<string, unknown>) => must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 30, props }, 's'));
const pathOf = (doc: MotionDoc) => String(findClip(doc, 's')!.clip.props.path);
const edit = (doc: MotionDoc, ...edits: PointEdit[]) => editPathPoints(doc, 's', edits);

const triangle = withShape({ shape: 'path', path: 'M0 0L1 0L1 1Z' });

describe('edit path points', () => {
  it('moves a point to an absolute spot of the box', () => {
    expect(pathOf(must(edit(triangle, { op: PointOp.Move, contour: 0, index: 2, to: [0.5, 0.5] })))).toBe('M0 0L1 0L0.5 0.5Z');
  });

  it('deletes a point', () => {
    expect(pathOf(must(edit(triangle, { op: PointOp.Delete, contour: 0, index: 1 })))).toBe('M0 0L1 1Z');
  });

  it('inserts a point on the segment after the given one, and later edits see it', () => {
    const result = must(edit(triangle, { op: PointOp.Insert, contour: 0, index: 0, t: 0.5 }, { op: PointOp.Move, contour: 0, index: 1, to: [0.5, 0.2] }));

    expect(pathOf(result)).toBe('M0 0L0.5 0.2L1 0L1 1Z');
  });

  it('smooths and squares a corner, and does nothing when it already is that', () => {
    const smooth = must(edit(triangle, { op: PointOp.Smooth, contour: 0, index: 1 }));

    expect(pathOf(smooth)).toContain('C');
    expect(pathOf(must(edit(smooth, { op: PointOp.Smooth, contour: 0, index: 1 })))).toBe(pathOf(smooth));
    expect(pathOf(must(edit(smooth, { op: PointOp.Corner, contour: 0, index: 1 })))).toBe('M0 0L1 0L1 1Z');
  });

  it('moves one handle without touching the other', () => {
    const smooth = must(edit(triangle, { op: PointOp.Smooth, contour: 0, index: 1 }));
    const bent = must(edit(smooth, { op: PointOp.Handle, contour: 0, index: 1, handle: Handle.Out, to: [1, 0.4] }));

    expect(pathOf(bent)).toContain('1 0.4');
  });

  it('writes a polygon as a path first', () => {
    const star = withShape({ shape: 'star', points: 5 });
    const result = must(edit(star, { op: PointOp.Delete, contour: 0, index: 0 }));

    expect(findClip(result, 's')!.clip.props.shape).toBe('path');
  });

  it('refuses a missing point, a move without a target, a vector and a non-shape', () => {
    expect(edit(triangle, { op: PointOp.Delete, contour: 0, index: 9 }).ok).toBe(false);
    expect(edit(triangle, { op: PointOp.Move, contour: 0, index: 1 }).ok).toBe(false);
    expect(edit(withShape({ shape: 'vector' }), { op: PointOp.Delete, contour: 0, index: 0 }).ok).toBe(false);
    expect(editPathPoints(triangle, 'missing', []).ok).toBe(false);
  });
});
