import { MAX_TRACKS, findClip, type MotionClip, type MotionDoc, type MotionTrack } from '../doc';
import { fillsOf } from '../fill/model';
import { StrokeAlign, strokesOf, type Stroke } from '../stroke/model';
import { setProps, type OpResult } from '../timeline';
import { flatten, pathData, polyline, type Pt } from './geometry';
import { ClipOp, Ends, Join, clipPolygons, offsetPolygons } from './polygon-clip';
import { baseOutline, type ShapeLook } from './render';
import { ShapeKind } from './schema';
import { pathSpace } from './space';

const UNIT = { w: 1, h: 1 };
const STROKE_TRACK = 'Stroke';
const EVEN_ODD = 'evenodd';

const REACH: Record<StrokeAlign, (w: number) => [outer: number, inner: number]> = {
  [StrokeAlign.Center]: (w) => [w / 2, -w / 2],
  [StrokeAlign.Inside]: (w) => [0, -w],
  [StrokeAlign.Outside]: (w) => [w, 0]
};

const JOIN: Record<Stroke['join'], Join> = { miter: Join.Miter, round: Join.Round, bevel: Join.Bevel };
const CAP: Record<Stroke['cap'], Ends> = { butt: Ends.Butt, round: Ends.Round, square: Ends.Square };

function strokeArea(doc: MotionDoc, clip: MotionClip, stroke: Stroke, frame: number): Pt[][] {
  const space = pathSpace(doc, clip.id, frame);
  const contours = baseOutline(clip.props as unknown as ShapeLook, UNIT);
  const inFrame = (closed: boolean) => contours.filter((c) => c.closed === closed).map((c) => flatten(c).map(space.toFrame));
  const width = stroke.width * Math.min(doc.width, doc.height);
  const join = JOIN[stroke.join];
  const [outer, inner] = REACH[stroke.align](width);
  const closed = inFrame(true);
  const ring = closed.length ? clipPolygons(offsetPolygons(closed, outer, join, Ends.Closed), offsetPolygons(closed, inner, join, Ends.Closed), ClipOp.Difference) : [];
  const open = inFrame(false);
  return [...ring, ...(open.length ? offsetPolygons(open, width / 2, join, CAP[stroke.cap]) : [])];
}

function strokeLayer(doc: MotionDoc, clip: MotionClip, look: Record<string, unknown>, newId: () => string): OpResult {
  const index = doc.tracks.findIndex((t) => t.clips.some((c) => c.id === clip.id));
  if (doc.tracks.length >= MAX_TRACKS) {
    return { ok: false, error: `a frame holds at most ${MAX_TRACKS} tracks: free one to outline this stroke` };
  }
  const unstroked = setProps(doc, clip.id, { strokes: [] });
  if (!unstroked.ok) {
    return unstroked;
  }
  const trackId = newId();
  const layer: MotionClip = { ...clip, id: newId(), props: { ...clip.props, ...look } };
  const track: MotionTrack = { id: trackId, kind: doc.tracks[index].kind, name: STROKE_TRACK, clips: [layer] };
  const tracks = unstroked.doc.tracks;
  return { ok: true, doc: { ...unstroked.doc, tracks: [...tracks.slice(0, index), track, ...tracks.slice(index)] } };
}

export function outlineStroke(doc: MotionDoc, clipId: string, frame: number, newId: () => string): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip || clip.component !== 'Shape') {
    return { ok: false, error: `${clipId} is not a shape` };
  }
  const stroke = strokesOf(clip.props).find((s) => s.visible && s.width > 0);
  if (!stroke) {
    return { ok: false, error: `${clipId} has no visible stroke to outline` };
  }

  const area = strokeArea(doc, clip, stroke, frame);
  if (!area.length) {
    return { ok: false, error: `the stroke of ${clipId} covers nothing` };
  }
  const local = pathSpace(doc, clip.id, frame);
  const look = { shape: ShapeKind.Path, path: pathData(area.map((poly) => polyline(poly.map(local.toLocal), true))), morphs: [], fills: [stroke.paint], strokes: [], fillRule: EVEN_ODD };

  const filled = fillsOf(clip.props).some((f) => f.visible);
  return filled ? strokeLayer(doc, clip, look, newId) : setProps(doc, clip.id, look);
}

export const outlineStrokes = (doc: MotionDoc, ids: readonly string[], frame: number, newId: () => string): OpResult =>
  ids.reduce<OpResult>((result, id) => (result.ok ? outlineStroke(result.doc, id, frame, newId) : result), { ok: true, doc });
