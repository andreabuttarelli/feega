import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { removeClips, setProps, type OpResult } from '../timeline';
import { flatten, pathData, polyline, type Pt } from './geometry';
import { baseOutline, type ShapeLook } from './render';
import { ShapeKind } from './schema';
import { pathSpace } from './space';
import { ClipOp, clipPolygons } from './polygon-clip';

export enum BooleanOp {
  Union = 'union',
  Subtract = 'subtract',
  Intersect = 'intersect',
  Exclude = 'exclude'
}

const CLIP_OP: Record<BooleanOp, ClipOp> = {
  [BooleanOp.Union]: ClipOp.Union,
  [BooleanOp.Subtract]: ClipOp.Difference,
  [BooleanOp.Intersect]: ClipOp.Intersection,
  [BooleanOp.Exclude]: ClipOp.Xor
};

const UNIT = { w: 1, h: 1 };
const MIN_SHAPES = 2;

export function polygonArea(points: readonly Pt[]): number {
  const twice = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  return Math.abs(twice) / 2;
}

function depth(doc: MotionDoc, clipId: string): [number, number] {
  const track = doc.tracks.findIndex((t) => t.clips.some((c) => c.id === clipId));
  return [track, -doc.tracks[track].clips.findIndex((c) => c.id === clipId)];
}

function bottomFirst(doc: MotionDoc) {
  return (a: MotionClip, b: MotionClip) => {
    const [ta, ca] = depth(doc, a.id);
    const [tb, cb] = depth(doc, b.id);
    return tb - ta || cb - ca;
  };
}

function polygonsInFrame(doc: MotionDoc, clip: MotionClip, frame: number): Pt[][] {
  const space = pathSpace(doc, clip.id, frame);
  return baseOutline(clip.props as unknown as ShapeLook, UNIT).map((contour) => flatten(contour).map(space.toFrame));
}

function shapesOf(doc: MotionDoc, ids: readonly string[]): MotionClip[] | string {
  const clips: MotionClip[] = [];
  for (const id of ids) {
    const clip = findClip(doc, id)?.clip;
    if (!clip || clip.component !== 'Shape') {
      return `${id} is not a shape`;
    }
    clips.push(clip);
  }
  return clips.length < MIN_SHAPES ? `a boolean needs at least ${MIN_SHAPES} shapes` : clips;
}

function combined(doc: MotionDoc, shapes: MotionClip[], op: BooleanOp, frame: number): Pt[][] {
  const [bottom, ...above] = shapes;
  const start = polygonsInFrame(doc, bottom, frame);
  if (op === BooleanOp.Subtract) {
    return clipPolygons(start, above.flatMap((c) => polygonsInFrame(doc, c, frame)), ClipOp.Difference);
  }
  return above.reduce((acc, clip) => clipPolygons(acc, polygonsInFrame(doc, clip, frame), CLIP_OP[op]), start);
}

export function combineShapes(doc: MotionDoc, ids: readonly string[], op: BooleanOp, frame: number): OpResult {
  const shapes = shapesOf(doc, ids);
  if (typeof shapes === 'string') {
    return { ok: false, error: shapes };
  }

  const ordered = [...shapes].sort(bottomFirst(doc));
  const result = combined(doc, ordered, op, frame);
  if (!result.length) {
    return { ok: false, error: `the ${op} leaves no shape` };
  }

  const bottom = ordered[0];
  const local = pathSpace(doc, bottom.id, frame);
  const path = pathData(result.map((poly) => polyline(poly.map(local.toLocal), true)));
  const reshaped = setProps(doc, bottom.id, { shape: ShapeKind.Path, path, morphs: [] });
  return reshaped.ok ? removeClips(reshaped.doc, ordered.slice(1).map((c) => c.id)) : reshaped;
}
