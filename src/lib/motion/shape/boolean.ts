import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { removeClips, setProps, type OpResult } from '../timeline';
import { flatten, mapOutline, pathData, polyline, type Outline, type Pt } from './geometry';
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

function spanOf(outline: Outline) {
  const points = outline.flatMap((c) => c.vertices.flatMap((v) => [v.p, v.in, v.out]));
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) || 1, height: Math.max(...ys) - Math.min(...ys) || 1 };
}

function reshapedTo(doc: MotionDoc, clip: MotionClip, outline: Outline, frame: number): OpResult {
  const span = spanOf(outline);
  const space = pathSpace(doc, clip.id, frame);
  const [fromX, fromY] = space.toFrame([0.5, 0.5]);
  const [toX, toY] = space.toFrame([span.left + span.width / 2, span.top + span.height / 2]);
  const props = clip.props as { x: number; y: number; width: number; height: number };
  const path = pathData(mapOutline(outline, (p) => [(p[0] - span.left) / span.width, (p[1] - span.top) / span.height]));
  return setProps(doc, clip.id, {
    shape: ShapeKind.Path,
    path,
    morphs: [],
    x: props.x + (toX - fromX) / doc.width,
    y: props.y + (toY - fromY) / doc.height,
    width: props.width * span.width,
    height: props.height * span.height
  });
}

function shapesOf(doc: MotionDoc, ids: readonly string[], least: number): MotionClip[] | string {
  const clips: MotionClip[] = [];
  for (const id of ids) {
    const clip = findClip(doc, id)?.clip;
    if (!clip || clip.component !== 'Shape') {
      return `${id} is not a shape`;
    }
    clips.push(clip);
  }
  return clips.length < least ? `this needs at least ${least} shapes` : clips;
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
  const shapes = shapesOf(doc, ids, MIN_SHAPES);
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
  const reshaped = reshapedTo(doc, bottom, result.map((poly) => polyline(poly.map(local.toLocal), true)), frame);
  return reshaped.ok ? removeClips(reshaped.doc, ordered.slice(1).map((c) => c.id)) : reshaped;
}

export function flattenShapes(doc: MotionDoc, ids: readonly string[], frame: number): OpResult {
  const shapes = shapesOf(doc, ids, 1);
  if (typeof shapes === 'string') {
    return { ok: false, error: shapes };
  }

  const ordered = [...shapes].sort(bottomFirst(doc));
  const bottom = ordered[0];
  const local = pathSpace(doc, bottom.id, frame);
  const outline = ordered.flatMap((clip) => {
    const space = pathSpace(doc, clip.id, frame);
    return mapOutline(baseOutline(clip.props as unknown as ShapeLook, UNIT), (p) => local.toLocal(space.toFrame(p)));
  });
  const reshaped = reshapedTo(doc, bottom, outline, frame);
  return reshaped.ok ? removeClips(reshaped.doc, ordered.slice(1).map((c) => c.id)) : reshaped;
}
