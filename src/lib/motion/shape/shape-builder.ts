import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { duplicateClip, editClip, removeClips, type OpResult } from '../timeline';
import { polyline, type Pt } from './geometry';
import { bottomFirst, polygonArea, polygonsInFrame, reshapedTo, shapesOf } from './boolean';
import { ClipOp, clipPolygons } from './polygon-clip';
import { pathSpace } from './space';

export type Region = { id: string; members: string[]; polygons: Pt[][] };
export type Picks = { merge: string[]; cut: string[] };
export type NewId = (index: number) => string;

const MIN_REGION_AREA = 1;
const MIN_SHAPES = 1;
const NOTHING_PICKED = 'pick at least one region to merge';

const area = (polygons: Pt[][]) => polygons.reduce((sum, p) => sum + polygonArea(p), 0);
const visible = (polygons: Pt[][]) => area(polygons) >= MIN_REGION_AREA;

function cutBy(regions: Omit<Region, 'id'>[], members: string[], polygons: Pt[][]): Omit<Region, 'id'>[] {
  const pieces: Omit<Region, 'id'>[] = [];
  let remainder = polygons;
  for (const region of regions) {
    const shared = clipPolygons(region.polygons, polygons, ClipOp.Intersection);
    const rest = clipPolygons(region.polygons, polygons, ClipOp.Difference);
    remainder = clipPolygons(remainder, region.polygons, ClipOp.Difference);
    if (visible(shared)) {
      pieces.push({ members: [...region.members, ...members], polygons: shared });
    }
    if (visible(rest)) {
      pieces.push({ members: region.members, polygons: rest });
    }
  }
  return visible(remainder) ? [...pieces, { members, polygons: remainder }] : pieces;
}

export function shapeRegions(doc: MotionDoc, ids: readonly string[], frame: number): Region[] {
  const shapes = shapesOf(doc, ids, MIN_SHAPES);
  if (typeof shapes === 'string') {
    return [];
  }
  const regions = [...shapes].sort(bottomFirst(doc)).reduce<Omit<Region, 'id'>[]>((acc, clip) => cutBy(acc, [clip.id], polygonsInFrame(doc, clip, frame)), []);
  return regions.map((r, i) => ({ ...r, id: `region${i}` }));
}

function inside(polygons: Pt[][], [x, y]: Pt): boolean {
  let crossings = 0;
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const [ax, ay] = polygon[i];
      const [bx, by] = polygon[(i + 1) % polygon.length];
      if (ay > y !== by > y && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) {
        crossings++;
      }
    }
  }
  return crossings % 2 === 1;
}

export function regionAt(regions: readonly Region[], at: Pt): Region | null {
  return regions.find((r) => inside(r.polygons, at)) ?? null;
}

type Piece = { source: string; polygons: Pt[][] };

function unionOf(regions: Region[]): Pt[][] {
  return regions.slice(1).reduce((acc, r) => clipPolygons(acc, r.polygons, ClipOp.Union), regions[0].polygons);
}

const topmost = (doc: MotionDoc, ids: string[]): string =>
  [...new Set(ids)]
    .map((id) => findClip(doc, id)!.clip)
    .sort(bottomFirst(doc))
    .at(-1)!.id;

function piecesOf(doc: MotionDoc, regions: Region[], picks: Picks): Piece[] {
  const merged = regions.filter((r) => picks.merge.includes(r.id));
  const rest = regions.filter((r) => !picks.merge.includes(r.id) && !picks.cut.includes(r.id));
  return [{ source: topmost(doc, merged.flatMap((r) => r.members)), polygons: unionOf(merged) }, ...rest.map((r) => ({ source: topmost(doc, r.members), polygons: r.polygons }))];
}

function placed(doc: MotionDoc, piece: Piece, id: string, frame: number): OpResult {
  const source = findClip(doc, piece.source)!.clip;
  const copied = duplicateClip(doc, piece.source, id);
  if (!copied.ok) {
    return copied;
  }
  const started = editClip(copied.doc, id, (clip: MotionClip) => ({ ...clip, from: source.from }));
  if (!started.ok) {
    return started;
  }
  const copy = findClip(started.doc, id)!.clip;
  const local = pathSpace(started.doc, id, frame);
  return reshapedTo(started.doc, copy, piece.polygons.map((poly) => polyline(poly.map(local.toLocal), true)), frame);
}

export function buildShapes(doc: MotionDoc, ids: readonly string[], frame: number, picks: Picks, newId: NewId): OpResult {
  if (!picks.merge.length) {
    return { ok: false, error: NOTHING_PICKED };
  }
  const sources = shapesOf(doc, ids, MIN_SHAPES);
  if (typeof sources === 'string') {
    return { ok: false, error: sources };
  }
  let next = doc;
  for (const [i, piece] of piecesOf(doc, shapeRegions(doc, ids, frame), picks).entries()) {
    const made = placed(next, piece, newId(i), frame);
    if (!made.ok) {
      return made;
    }
    next = made.doc;
  }
  const cleared = removeClips(next, sources.map((c) => c.id));
  return cleared.ok ? { ok: true, doc: { ...cleared.doc, durationInFrames: doc.durationInFrames } } : cleared;
}
