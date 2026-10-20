import { findClip, type MotionDoc } from '../doc';
import type { OpResult } from '../timeline';
import { parsePath, pathData, type Outline, type Pt } from './geometry';
import { Handle, Mirror, deletePoint, dragHandle, insertPoint, isCorner, movePoint, toggleClosed, toggleSmooth, type PointRef } from './pen';
import { setPath, shapePath, type ShapeParams } from './ops';
import { ShapeKind } from './schema';

export enum PointOp {
  Move = 'move',
  Delete = 'delete',
  Insert = 'insert',
  Smooth = 'smooth',
  Corner = 'corner',
  Handle = 'handle',
  Close = 'close'
}

export type PointEdit = { op: PointOp; contour: number; index: number; to?: Pt; t?: number; handle?: Handle };

const fail = (error: string): OpResult => ({ ok: false, error });

const vertexAt = (outline: Outline, ref: PointRef) => outline[ref.contour]?.vertices[ref.index];

const NEEDS_TO = new Set([PointOp.Move, PointOp.Handle]);

function applyEdit(outline: Outline, edit: PointEdit): Outline | string {
  const vertex = vertexAt(outline, edit);
  if (!vertex) {
    return `no point ${edit.contour}.${edit.index}`;
  }
  if (NEEDS_TO.has(edit.op) && !edit.to) {
    return `${edit.op} needs "to"`;
  }

  const to = edit.to ?? vertex.p;
  const ACTIONS: Record<PointOp, () => Outline> = {
    [PointOp.Move]: () => movePoint(outline, edit, [to[0] - vertex.p[0], to[1] - vertex.p[1]]),
    [PointOp.Delete]: () => deletePoint(outline, edit),
    [PointOp.Insert]: () => insertPoint(outline, { contour: edit.contour, index: edit.index, t: edit.t ?? 0.5 }).outline,
    [PointOp.Smooth]: () => (isCorner(vertex) ? toggleSmooth(outline, edit) : outline),
    [PointOp.Corner]: () => (isCorner(vertex) ? outline : toggleSmooth(outline, edit)),
    [PointOp.Handle]: () => dragHandle(outline, edit, edit.handle ?? Handle.Out, to, Mirror.Broken),
    [PointOp.Close]: () => toggleClosed(outline, edit.contour)
  };
  return ACTIONS[edit.op]();
}

function startOutline(props: Record<string, unknown>): Outline | string {
  if (props.shape === ShapeKind.Vector) {
    return 'this is a vector network: use set_vector_network';
  }
  return parsePath(props.shape === ShapeKind.Path ? String(props.path ?? '') : shapePath(props as unknown as ShapeParams));
}

export function editPathPoints(doc: MotionDoc, clipId: string, edits: readonly PointEdit[]): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip || clip.component !== 'Shape') {
    return fail(`${clipId} is not a shape`);
  }

  let outline = startOutline(clip.props);
  for (const edit of edits) {
    if (typeof outline === 'string') {
      return fail(outline);
    }
    outline = applyEdit(outline, edit);
  }
  return typeof outline === 'string' ? fail(outline) : setPath(doc, clipId, pathData(outline));
}
